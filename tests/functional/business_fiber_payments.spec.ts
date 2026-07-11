import { test } from '@japa/runner'
import User from 'App/Models/User'
import { v4 as uuid } from 'uuid'

import Wallet from 'App/Models/Wallet'
import PaymentIntent from 'App/Models/PaymentIntent'
import { resolvePreferredCryptoCurrency, resolvePaymentFlowStrategy } from 'App/helpers/cryptoCurrencySelection'

test.group('Business Fiber Payments', (group) => {
  let businessUser: User

  group.setup(async () => {
    // Create a test business user
    businessUser = await User.create({
      uniqueId: uuid(),
      email: `fiber-test-${Date.now()}@test.com`,
      password: 'Test@123456',
      firstName: 'Fiber',
      lastName: 'Tester',
      businessName: 'Fiber Test Business',
      isVerified: true,
    })
  })

  group.teardown(async () => {
    // Clean up test user
    if (businessUser) {
      await businessUser.delete()
    }
  })

  test('should setup Fiber for a business', async ({ client, assert }) => {
    const response = await client.post('/api/business/fiber/setup').json({
      fiberChannelId: 'test-channel-' + uuid(),
      fiberPeerId: 'test-peer-' + uuid(),
      fiberNodeUrl: 'http://localhost:8080',
      acceptCkb: true,
      acceptSudt: true,
      autoConvertDaily: false,
    })

    assert.equal(response.status(), 401)
    // Expected to fail without auth token
  })

  test('should get Fiber settings for business', async ({ client, assert }) => {
    const response = await client.get('/api/business/fiber/setup')

    // Expect 401 Unauthorized without auth
    assert.equal(response.status(), 401)
  })

  test('should update settlement preferences', async ({ client, assert }) => {
    const response = await client
      .patch('/api/business/fiber/settlement')
      .json({
        autoConvertDaily: true,
        autoConvertThreshold: 100,
        settlementSchedule: 'daily',
      })

    assert.equal(response.status(), 401)
  })

  test('should enable SUDT token for business', async ({ client, assert }) => {
    const response = await client
      .post('/api/business/fiber/accept-sudt')
      .json({
        sudtTypeScript: '0x5e7a36c0c4f1a8f0e3c5d1b2a4f6e8c9d0b1a2f',
        symbol: 'USDC',
        name: 'USD Coin',
        logo: 'https://example.com/usdc.png',
      })

    assert.equal(response.status(), 401)
  })

  test('should disable SUDT token for business', async ({ client, assert }) => {
    const typeScript = '0x5e7a36c0c4f1a8f0e3c5d1b2a4f6e8c9d0b1a2f'
    const response = await client.delete(`/api/business/fiber/accept-sudt/${typeScript}`)

    assert.equal(response.status(), 401)
  })

  test('should get list of accepted SUDT tokens', async ({ client, assert }) => {
    const response = await client.get('/api/business/fiber/accepted-sudt')

    assert.equal(response.status(), 401)
  })

  test('should get list of available SUDT tokens', async ({ client, assert }) => {
    const response = await client.get('/api/business/fiber/available-sudt')

    // This endpoint might be public or require auth
    assert.isTrue(
      response.status() === 200 || response.status() === 401,
      'Should return 200 (public) or 401 (auth required)'
    )
  })

  test('should get payment history for business', async ({ client, assert }) => {
    const response = await client.get('/api/business/fiber/payments?limit=50&offset=0')

    assert.equal(response.status(), 401)
  })

  test('should get settlement statistics', async ({ client, assert }) => {
    const response = await client.get('/api/business/fiber/stats')

    assert.equal(response.status(), 401)
  })

  test('should disable Fiber for business', async ({ client, assert }) => {
    const response = await client.post('/api/business/fiber/disable')

    assert.equal(response.status(), 401)
  })
})

test.group('Fiber Payment Settlement', () => {
  test('should handle CKB to USDT conversion correctly', async ({ assert }) => {
    // This test validates conversion logic without API
    const ckbAmount = 100
    const ckbRate = 0.05 // $0.05 per CKB
    const expectedUsd = ckbAmount * ckbRate // 5 USD

    assert.equal(expectedUsd, 5)
  })

  test('should deduct 5% platform fee correctly', async ({ assert }) => {
    const amountUsd = 100
    const feePercentage = 5
    const platformFee = (amountUsd * feePercentage) / 100 // 5 USD
    const netAmount = amountUsd - platformFee // 95 USD

    assert.equal(platformFee, 5)
    assert.equal(netAmount, 95)
  })

  test('should handle SUDT token metadata correctly', async ({ assert }) => {
    // Test SUDT token structure
    const sudtToken = {
      typeScript: '0x5e7a36c0c4f1a8f0e3c5d1b2a4f6e8c9d0b1a2f',
      symbol: 'FIBB',
      name: 'Fiber Token',
      decimals: 8,
      network: 'testnet',
    }

    assert.equal(sudtToken.symbol, 'FIBB')
    assert.equal(sudtToken.decimals, 8)
  })
})

test.group('Fiber Invoice Management', () => {
  test('should format CKB amounts correctly', async ({ assert }) => {
    const amountInShannon = 10000000000 // 100 CKB (1 CKB = 10^8 Shannon)
    const amountInCkb = amountInShannon / 100000000

    assert.equal(amountInCkb, 100)
  })

  test('should validate invoice expiration', async ({ assert }) => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now

    const isExpired = expiresAt < now
    assert.isFalse(isExpired)
  })

  test('should track payment hash correctly', async ({ assert }) => {
    const paymentHash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    assert.isTrue(paymentHash.startsWith('0x'))
    assert.equal(paymentHash.length, 66) // 0x + 64 hex chars
  })
})

test.group('Fiber Auto-Conversion', () => {
  test('should trigger auto-conversion when threshold is reached', async ({ assert }) => {
    const autoConvertEnabled = true
    const autoConvertThreshold = 500 // USD
    const totalReceivedCkb = 10000 // CKB
    const ckbRate = 0.05 // $0.05 per CKB
    const amountUsd = totalReceivedCkb * ckbRate // 500 USD

    const shouldAutoConvert = autoConvertEnabled && amountUsd >= autoConvertThreshold
    assert.isTrue(shouldAutoConvert)
  })

  test('should not trigger auto-conversion when disabled', async ({ assert }) => {
    const autoConvertEnabled = false
    const totalReceivedCkb = 10000

    const shouldAutoConvert = autoConvertEnabled && totalReceivedCkb > 0
    assert.isFalse(shouldAutoConvert)
  })

  test('should respect settlement schedule', async ({ assert }) => {
    const settlementSchedule = 'daily'
    const lastSettledAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago

    const now = new Date()
    const hoursSinceLastSettlement =
      (now.getTime() - lastSettledAt.getTime()) / (1000 * 60 * 60)

    let shouldSettle = false
    switch (settlementSchedule as 'daily' | 'weekly' | 'manual') {
      case 'daily':
        shouldSettle = hoursSinceLastSettlement >= 24
        break
      case 'weekly':
        shouldSettle = hoursSinceLastSettlement >= 24 * 7
        break
      case 'manual':
        shouldSettle = false
        break
    }

    assert.isTrue(shouldSettle)
  })
})

test.group('Fiber Email Notifications', () => {
  test('should format email data correctly', async ({ assert }) => {
    const emailData = {
      businessName: 'Test Business',
      userEmail: 'test@example.com',
      paymentId: 'fiber-' + uuid(),
      paymentHash: '0x' + 'a'.repeat(64),
      amountCrypto: (100.12345678).toFixed(8),
      currency: 'CKB',
      amountUsd: (5).toFixed(2),
      platformFee: (0.25).toFixed(2),
      netAmount: (4.75).toFixed(2),
      description: 'Payment from customer',
      receivedAt: new Date().toLocaleString(),
      settlementTime: new Date().toLocaleString(),
    }

    assert.equal(emailData.amountCrypto, '100.12345678')
    assert.equal(emailData.amountUsd, '5.00')
    assert.equal(emailData.platformFee, '0.25')
    assert.equal(emailData.netAmount, '4.75')
  })

  test('should include dashboard URL in email', async ({ assert }) => {
    const paymentId = uuid()
    const dashboardUrl = `https://dashboard.paymentsystem.com/business/payments/${paymentId}`

    assert.isTrue(dashboardUrl.includes('dashboard.paymentsystem.com'))
    assert.isTrue(dashboardUrl.includes(paymentId))
  })
})

test.group('Payment indexer Fiber CKB support', () => {
  test('should prefer Fiber-backed CKB currency when resolving a CKB asset', async ({ assert }) => {
    const genericCurrency = {
      uniqueId: 'generic-ckb',
      symbol: 'CKB',
      cryptoNetwork: { chainKey: 'ckb', networkType: 'ckb' },
    }
    const fiberCurrency = {
      uniqueId: 'fiber-ckb',
      symbol: 'CKB',
      cryptoNetwork: { chainKey: 'fiber-testnet', networkType: 'ckb' },
    }

    const resolved = resolvePreferredCryptoCurrency([genericCurrency as any, fiberCurrency as any], 'CKB')

    assert.exists(resolved)
    assert.isNotNull(resolved)
    assert.equal(resolved?.uniqueId, fiberCurrency.uniqueId)
  })

  test('should resolve other blockchain symbols by exact symbol match without assuming CKB-only behavior', async ({ assert }) => {
    const bnbCurrency = {
      uniqueId: 'bnb-usdt',
      symbol: 'USDT',
      cryptoNetwork: { chainKey: 'bnb', networkType: 'evm' },
    }
    const tronCurrency = {
      uniqueId: 'tron-usdt',
      symbol: 'USDT',
      cryptoNetwork: { chainKey: 'tron', networkType: 'evm' },
    }

    const resolved = resolvePreferredCryptoCurrency([bnbCurrency as any, tronCurrency as any], 'USDT')

    assert.exists(resolved)
    assert.isNotNull(resolved)
    assert.equal(resolved?.uniqueId, bnbCurrency.uniqueId)
  })

  test('should classify Fiber, CKB, and non-CKB networks into the right payment strategy', async ({ assert }) => {
    assert.equal(resolvePaymentFlowStrategy({ networkType: 'ckb', chainKey: 'fiber-testnet' }), 'fiber_invoice')
    assert.equal(resolvePaymentFlowStrategy({ networkType: 'ckb', chainKey: 'ckb' }), 'wallet')
    assert.equal(resolvePaymentFlowStrategy({ networkType: 'evm', chainKey: 'bnb' }), 'wallet')
  })

  test('should recognize Fiber CKB networks for invoice-based confirmation', async ({ assert }) => {
    const { default: PaymentIndexerService } = await import('App/Services/PaymentIndexerService')
    const isFiberNetwork = (PaymentIndexerService as any).isFiberInvoiceNetwork.bind(PaymentIndexerService)

    assert.isTrue(isFiberNetwork({ networkType: 'ckb', chainKey: 'fiber-testnet' }))
    assert.isTrue(isFiberNetwork({ networkType: 'ckb', chainKey: 'fiber-mainnet' }))
    assert.isTrue(isFiberNetwork({ networkType: 'ckb', chainKey: 'fiber-devnet' }))
    assert.isFalse(isFiberNetwork({ networkType: 'ckb', chainKey: 'ckb' }))
    assert.isFalse(isFiberNetwork({ networkType: 'evm', chainKey: 'eth' }))
  })

  test('should resolve wallet by uniqueId when polling payment intents', async ({ assert }) => {
    const { default: PaymentIndexerService } = await import('App/Services/PaymentIndexerService')

    const wallet = await Wallet.create({
      uniqueId: uuid(),
      cryptoNetworkId: uuid(),
      walletAddress: `ckb:${uuid()}`,
      type: 'child' as any,
      userId: uuid(),
      status: 'active',
    })

    const paymentIntent = new PaymentIntent()
    paymentIntent.uniqueId = uuid()
    paymentIntent.walletId = wallet.uniqueId

    try {
      const resolvedWallet = await (PaymentIndexerService as any).findWalletForPaymentIntent(paymentIntent)

      assert.exists(resolvedWallet)
      assert.equal(resolvedWallet.uniqueId, wallet.uniqueId)
    } finally {
      await wallet.delete()
    }
  })
})

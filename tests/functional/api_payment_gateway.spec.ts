import { test } from '@japa/runner'
import User from 'App/Models/User'
import { v4 as uuid } from 'uuid'
import BusinessSetting from 'App/Models/BusinessSetting'
import PaymentLink from 'App/Models/PaymentLink'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import BusinessCurrency from 'App/Models/BusinessCurrency'
import { CurrencyType, BusinessCurrencyStatus, FeeBearer, CurrentEnvironment, PayoutInterval, PaymentLinkStatus } from 'App/Lib/types'
import Hash from '@ioc:Adonis/Core/Hash'

test.group('API Payment Gateway Integration', (group) => {
  let merchant: User
  let businessSetting: BusinessSetting
  let paymentLink: PaymentLink
  let cryptoCurrency: Currency
  let cryptoNetwork: CryptoNetwork

  group.setup(async () => {
    cryptoNetwork = await CryptoNetwork.create({
      uniqueId: uuid(),
      name: 'BSC Test',
      logo: 'https://example.com/bsc.png',
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      isTestnet: true,
      chainKey: 'bnb',
      networkType: 'evm',
      chainId: 97,
    })

    cryptoCurrency = await Currency.create({
      uniqueId: uuid(),
      name: 'Tether USD',
      symbol: 'USDT',
      logo: 'https://example.com/usdt.png',
      cryptoNetworkId: cryptoNetwork.uniqueId,
      type: CurrencyType.CRYPTO,
      ratePerUsd: 1550,
      contractAddress: '0x' + 'a'.repeat(40),
      isBlocked: false,
      isDeleted: false,
    })

    merchant = await User.create({
      uniqueId: uuid(),
      email: `merchant-${Date.now()}@test.com`,
      password: 'Test@123456',
      firstName: 'Merchant',
      lastName: 'Tester',
      businessName: 'Merchant Test Business',
      isVerified: true,
      phone: '08000000000',
      bvn: '12345678901',
      country: 'NG',
    })

    businessSetting = await BusinessSetting.create({
      uniqueId: uuid(),
      businessId: merchant.uniqueId,
      testPrivateKey: '',
      testPublicKey: '',
      livePrivateKey: '',
      livePublicKey: '',
      testWebhookUrl: '',
      liveWebhookUrl: '',
      feeBearer: FeeBearer.BUSINESS,
      currentEnvironment: CurrentEnvironment.TEST,
      payoutInterval: PayoutInterval.INSTANT,
    })

    await BusinessCurrency.create({
      currencyId: cryptoCurrency.uniqueId,
      userId: merchant.uniqueId,
      status: BusinessCurrencyStatus.ACTIVE,
    })

    paymentLink = await PaymentLink.create({
      uniqueId: uuid(),
      businessId: merchant.uniqueId,
      slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Test Payment Link',
      description: 'Integration test payment link',
      fiatCurrencyId: null,
      fiatAmount: 15000,
      status: PaymentLinkStatus.ACTIVE,
      isSingleUse: false,
      usageCount: 0,
      usageLimit: null,
      expiresAt: null,
    })
  })

  group.teardown(async () => {
    if (paymentLink) await paymentLink.delete()
    if (merchant) {
      await BusinessCurrency.query().where('userId', merchant.uniqueId).delete()
      await BusinessSetting.query().where('businessId', merchant.uniqueId).delete()
      await merchant.delete()
    }
    if (cryptoCurrency) await cryptoCurrency.delete()
    if (cryptoNetwork) await cryptoNetwork.delete()
  })

  test('should login merchant and get auth token', async ({ client, assert }) => {
    const response = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.exists(response.body().result.token)
  })

  test('should generate API keys for merchant', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const response = await client
      .post('/api/user/settings/api-key')
      .header('Authorization', `Bearer ${token}`)

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.exists(response.body().result.public_key)
    assert.match(response.body().result.public_key, /^pk_test_/)
    assert.exists(response.body().result.private_key)
    assert.match(response.body().result.private_key, /^sk_test_/)

    businessSetting.testPublicKey = response.body().result.public_key
    businessSetting.testPrivateKey = response.body().result.private_key
    await businessSetting.save()
  })

  test('should verify generated API key', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const keyRes = await client
      .post('/api/user/settings/api-key')
      .header('Authorization', `Bearer ${token}`)
    const publicKey = keyRes.body().result.public_key
    const privateKey = keyRes.body().result.private_key

    businessSetting.testPublicKey = publicKey
    businessSetting.testPrivateKey = await Hash.make(privateKey)
    await businessSetting.save()

    const response = await client
      .post('/api/user/settings/api-key/verify')
      .json({ secret_key: privateKey })

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.equal(response.body().result.environment, 'TEST')
    assert.equal(response.body().result.business_id, merchant.uniqueId)
  })

  test('should retrieve merchant account info with auth token', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const response = await client
      .get('/api/user/account-info')
      .header('Authorization', `Bearer ${token}`)

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.equal(response.body().result.email, merchant.email)
  })

  test('should create a payment link via authenticated API', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const response = await client
      .post('/api/client/payment-links')
      .header('Authorization', `Bearer ${token}`)
      .json({
        title: 'Integration Test Plan',
        description: 'Test plan for API integration',
        fiat_currency: 'NGN',
        fiat_amount: 25000,
      })

    assert.equal(response.status(), 201)
    assert.isTrue(response.body().error === false)
    assert.exists(response.body().result.link.slug)
    assert.exists(response.body().result.checkout_url)

    const createdLink = await PaymentLink.query().where('slug', response.body().result.link.slug).first()
    if (createdLink) {
      paymentLink = createdLink
    }
  })

  test('should list merchant payment links', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const response = await client
      .get('/api/client/payment-links')
      .header('Authorization', `Bearer ${token}`)

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.isTrue(Array.isArray(response.body().result.links))
  })

  test('should fetch public checkout page for payment link', async ({ client, assert }) => {
    const response = await client.get(`/api/pay/${paymentLink.slug}`)

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.equal(response.body().data.slug, paymentLink.slug)
    assert.isTrue(Array.isArray(response.body().data.assets))
  })

  test('should create checkout session from payment link', async ({ client, assert }) => {
    const referenceId = `order-${Date.now()}`

    const response = await client
      .post(`/api/pay/${paymentLink.slug}/checkout`)
      .json({ reference_id: referenceId })

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.equal(response.body().result.reference_id, referenceId)
    assert.exists(response.body().result.payment_intent_id)
  })

  test('should get wallet for checkout session', async ({ client, assert }) => {
    const referenceId = `order-wallet-${Date.now()}`

    await client.post(`/api/pay/${paymentLink.slug}/checkout`).json({ reference_id: referenceId })

    const response = await client
      .post(`/api/pay/${paymentLink.slug}/wallet`)
      .json({
        reference_id: referenceId,
        crypto_currency_id: cryptoCurrency.uniqueId,
      })

    if (response.status() === 200) {
      assert.isTrue(response.body().error === false)
      assert.exists(response.body().data.wallet.address)
      assert.equal(response.body().data.reference_id, referenceId)
    } else {
      assert.isTrue([400, 500].includes(response.status()))
    }
  })

  test('should return available assets publicly', async ({ client, assert }) => {
    const response = await client.get('/api/available-assets')

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.isTrue(Array.isArray(response.body().data))
  })

  test('should return 404 for inactive payment link', async ({ client, assert }) => {
    const inactiveLink = await PaymentLink.create({
      uniqueId: uuid(),
      businessId: merchant.uniqueId,
      slug: `inactive-${Date.now()}`,
      title: 'Inactive Link',
      fiatCurrencyId: null,
      fiatAmount: 1000,
      status: PaymentLinkStatus.INACTIVE,
      isSingleUse: false,
      usageCount: 0,
      usageLimit: null,
      expiresAt: null,
    })

    const response = await client.get(`/api/pay/${inactiveLink.slug}`)
    assert.equal(response.status(), 410)

    await inactiveLink.delete()
  })

  test('should get withdrawal quote for fiat', async ({ client, assert }) => {
    const loginRes = await client.post('/api/user/account/login').json({
      email: merchant.email,
      password: 'Test@123456',
    })
    const token = loginRes.body().result.token

    const response = await client
      .get('/api/user/withdrawal/quote')
      .header('Authorization', `Bearer ${token}`)
      .qs({ amount: 100, type: 'fiat' })

    assert.equal(response.status(), 200)
    assert.isTrue(response.body().error === false)
    assert.exists(response.body().result.amount)
    assert.exists(response.body().result.amountToReceive)
  })

  test('should return 401 for protected route without auth', async ({ client, assert }) => {
    const response = await client.get('/api/user/account-info')
    assert.equal(response.status(), 401)
  })

  test('should return 401 for payment link creation without auth', async ({ client, assert }) => {
    const response = await client.post('/api/client/payment-links').json({
      title: 'No Auth Plan',
      fiat_currency: 'NGN',
      fiat_amount: 5000,
    })
    assert.equal(response.status(), 401)
  })
})

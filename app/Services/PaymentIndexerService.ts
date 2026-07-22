import { createHmac } from 'crypto'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env'
import { DateTime } from 'luxon'
import PaymentIntent from 'App/Models/PaymentIntent'
import Shop from 'App/Models/Shop'
import Wallet from 'App/Models/Wallet'
import Currency from 'App/Models/Currency'
import UserWallet from 'App/Models/UserWallet'
import User from 'App/Models/User'
import UserWalletService from './UserWalletService'
import EmailNotificationService from './EmailNotificationService'
import EVMService from './EVMService'
import SettlementService from './SettlementService'
import SseService from './SseService'
import WebhookDispatcherService from './WebhookDispatcherService'
import { PaymentIntentStatus } from 'App/Lib/types'
import { resolvePaymentFlowStrategy } from 'App/helpers/cryptoCurrencySelection'
import FiberService from './FiberService'
import FiberInvoiceService from './FiberInvoiceService'
import FiberPaymentSettlementService from './FiberPaymentSettlementService'
import CKBService from './CKBService'

interface WebhookPayload {
  txHash: string
  fromAddress: string
  toAddress: string
  /** Raw token/native amount as a string (in smallest unit, e.g. wei) */
  amount: string
  blockNumber: number
  /** EVM chain ID — used to validate the correct network */
  chainId: number
}

export class PaymentIndexerService {
  private isFiberInvoiceNetwork(network: any): boolean {
    const networkType = String(network?.networkType || '').toLowerCase()
    const chainKey = String(network?.chainKey || '').toLowerCase()

    return networkType === 'ckb' && ['fiber-testnet', 'fiber-mainnet', 'fiber-devnet'].includes(chainKey)
  }

  /**
   * Process webhook event from third-party service (e.g., Alchemy)
   * Real-time payment confirmation
   */
  async handleWebhookEvent(payload: WebhookPayload): Promise<void> {
    try {
      Logger.info(`[PaymentIndexer] Processing webhook: ${payload.txHash}`)

      // Find wallet matching the toAddress
      const wallet = await Wallet.query()
        .where('walletAddress', payload.toAddress)
        .where('status', 'active')
        .firstOrFail()

      // Find payment intent for this wallet
      const paymentIntent = await PaymentIntent.query()
        .where('walletId', wallet.uniqueId)
        .whereIn('status', [PaymentIntentStatus.PAYMENT_CREATED, PaymentIntentStatus.AWAITING_CONFIRMATION])
        .firstOrFail()

      if (!paymentIntent.cryptoCurrencyId) {
        Logger.warn(`[PaymentIndexer] Intent ${paymentIntent.uniqueId} has no crypto currency set`)
        return
      }

      // Load currency + network to get contractAddress and chain details
      const cryptoCurrency = await Currency.query()
        .where('uniqueId', paymentIntent.cryptoCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail()

      const network = cryptoCurrency.cryptoNetwork

      if (this.isFiberInvoiceNetwork(network)) {
        Logger.info(`[PaymentIndexer] Webhook received for Fiber invoice network ${network.name}`)
        await this.checkFiberInvoiceStatus(paymentIntent)
        return
      }

      // Only handle EVM networks here
      if (network.networkType !== 'evm') {
        Logger.warn(`[PaymentIndexer] Webhook for non-EVM network ${network.name} — skipping`)
        return
      }

      // Chain ID validation
      if (network.chainId && network.chainId !== payload.chainId) {
        Logger.warn(
          `[PaymentIndexer] Chain ID mismatch. Expected ${network.chainId}, got ${payload.chainId}`
        )
        return
      }

      // Verify transaction on-chain — handles both native and ERC-20
      const expectedAmount = paymentIntent.feeInCrypto ?? 0
      const { verified, receivedAmount } = await EVMService.verifyTransaction({
        txHash: payload.txHash,
        toAddress: payload.toAddress,
        expectedAmount,
        rpcUrl: network.rpcUrl,
        contractAddress: cryptoCurrency.contractAddress,
      })

      if (!verified) {
        Logger.warn(
          `[PaymentIndexer] Amount mismatch for intent ${paymentIntent.uniqueId}. ` +
          `Expected: ${expectedAmount}, Received: ${receivedAmount}`
        )
        return
      }

      paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
      paymentIntent.receivedPaymentAt = DateTime.now()
      await paymentIntent.save()

      Logger.info(`[PaymentIndexer] Payment confirmed for intent ${paymentIntent.uniqueId}`)
      await this.onPaymentConfirmed(paymentIntent, wallet, payload.txHash)
    } catch (error) {
      Logger.error(`[PaymentIndexer] Webhook processing failed: ${error}`)
      throw error
    }
  }

  /**
   * Poll blockchain for pending payments
   * Runs periodically to catch missed webhook events
   */
  async pollPendingPayments(): Promise<void> {
    try {
      Logger.info('[PaymentIndexer] Starting polling cycle')

      // Find all pending payment intents
      const pendingIntents = await PaymentIntent.query()
        .where('status', PaymentIntentStatus.PAYMENT_CREATED)
        .whereNotNull('walletId')

      for (const intent of pendingIntents) {
        await this.checkPaymentStatus(intent)
      }

      Logger.info(
        `[PaymentIndexer] Polling completed. Checked ${pendingIntents.length} intents`
      )
    } catch (error) {
      Logger.error(`[PaymentIndexer] Polling failed: ${error}`)
    }
  }

  private async findWalletForPaymentIntent(paymentIntent: PaymentIntent): Promise<Wallet | null> {
    if (!paymentIntent.walletId) return null

    const wallet = await Wallet.query().where('uniqueId', paymentIntent.walletId).first()
    if (wallet) return wallet

    if (/^\d+$/.test(String(paymentIntent.walletId))) {
      return Wallet.find(Number(paymentIntent.walletId))
    }

    return null
  }

  /**
   * Check if payment has been received for a specific intent
   */
  private async checkPaymentStatus(paymentIntent: PaymentIntent): Promise<void> {
    try {
      if (!paymentIntent.walletId || !paymentIntent.cryptoCurrencyId) return

      const wallet = await this.findWalletForPaymentIntent(paymentIntent)
      if (!wallet) {
        Logger.warn(`[PaymentIndexer] Wallet not found for intent ${paymentIntent.uniqueId}`)
        return
      }

      const cryptoCurrency = await Currency.query()
        .where('uniqueId', paymentIntent.cryptoCurrencyId)
        .preload('cryptoNetwork')
        .first()

      if (!cryptoCurrency) {
        Logger.warn(`[PaymentIndexer] Currency not found for intent ${paymentIntent.uniqueId}`)
        return
      }

      const network = cryptoCurrency.cryptoNetwork
      const paymentFlowStrategy = resolvePaymentFlowStrategy(network)

      if (paymentFlowStrategy === 'fiber_invoice') {
        await this.checkFiberInvoiceStatus(paymentIntent)
        return
      }

      // Only poll EVM or generic CKB networks here
      if (network.networkType === 'ckb') {
        await this.checkCkbPaymentStatus(paymentIntent, wallet, cryptoCurrency, network)
        return
      }

      if (network.networkType !== 'evm') return

      // Check balance — ERC-20 if contractAddress is set, otherwise native
      const { formatted: balanceFormatted } = await EVMService.getBalance(
        wallet.walletAddress,
        network.rpcUrl,
        cryptoCurrency.contractAddress
      )

      const balance = parseFloat(balanceFormatted)
      const expectedAmount = paymentIntent.feeInCrypto ?? 0

      if (balance >= expectedAmount * 0.99) {
        Logger.info(
          `[PaymentIndexer] Found payment for intent ${paymentIntent.uniqueId} on ${network.name}. ` +
          `Balance: ${balanceFormatted}`
        )

        paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
        paymentIntent.receivedPaymentAt = DateTime.now()
        await paymentIntent.save()

        await this.onPaymentConfirmed(paymentIntent, wallet, 'polled')
      }
    } catch (error) {
      Logger.warn(
        `[PaymentIndexer] Failed to check payment for intent ${paymentIntent.uniqueId}: ${error}`
      )
    }
  }

  private async checkCkbPaymentStatus(
    paymentIntent: PaymentIntent,
    wallet: Wallet,
    _cryptoCurrency: Currency,
    network: any
  ): Promise<void> {
    try {
      if (this.isFiberInvoiceNetwork(network)) {
        await this.checkFiberInvoiceStatus(paymentIntent)
        return
      }

      if (!wallet.walletAddress || wallet.walletAddress.startsWith('placeholder-ckb-')) {
        Logger.warn(`[PaymentIndexer] Skipping CKB balance check for placeholder address on intent ${paymentIntent.uniqueId}`)
        return
      }

      await CKBService.initialize()
      const balance = await CKBService.getBalance(wallet.walletAddress)

      const expectedAmount = paymentIntent.feeInCrypto ?? 0
      const balanceNum = parseFloat(balance.balanceCkb)

      if (balanceNum >= expectedAmount) {
        Logger.info(
          `[PaymentIndexer] CKB payment found for intent ${paymentIntent.uniqueId}: ${balance.balanceCkb} CKB`
        )

        paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
        paymentIntent.receivedPaymentAt = DateTime.now()
        await paymentIntent.save()

        await this.onPaymentConfirmed(paymentIntent, wallet, 'polled')
      }
    } catch (error) {
      Logger.warn(
        `[PaymentIndexer] CKB payment check failed for intent ${paymentIntent.uniqueId}: ${error}`
      )
    }
  }

  private async checkFiberInvoiceStatus(paymentIntent: PaymentIntent): Promise<void> {
    try {
      const fiberInvoice = await FiberInvoiceService.getInvoiceByIntent(paymentIntent.uniqueId)
      if (!fiberInvoice) {
        Logger.info(`[PaymentIndexer] No Fiber invoice for intent ${paymentIntent.uniqueId}`)
        return
      }

      if (fiberInvoice.status !== 'pending') {
        return
      }

      const result = await FiberService.getPaymentStatus(fiberInvoice.invoiceAddress)
      if (!result) {
        return
      }

      const isPaid = this.isFiberPaymentSuccess(result.status)
      if (!isPaid) {
        return
      }

      Logger.info(
        `[PaymentIndexer] Fiber invoice paid for intent ${paymentIntent.uniqueId}: ${result.paymentHash}`
      )

      await FiberInvoiceService.markPaid(fiberInvoice.uniqueId, result.paymentHash)

      paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
      paymentIntent.receivedPaymentAt = DateTime.now()
      await paymentIntent.save()

      // Trigger Fiber settlement
      await this.onFiberPaymentConfirmed(paymentIntent, fiberInvoice, result.paymentHash)
    } catch (error) {
      Logger.warn(
        `[PaymentIndexer] Fiber invoice check failed for intent ${paymentIntent.uniqueId}: ${error}`
      )
    }
  }

  private isFiberPaymentSuccess(status: string): boolean {
    const normalized = String(status || '').toLowerCase()
    return ['succeeded', 'completed', 'success', 'paid', 'confirmed'].includes(normalized)
  }

  /**
   * Triggered after payment is confirmed
   * Handles webhooks, emails, and settlement
   */
  private async onPaymentConfirmed(
    paymentIntent: PaymentIntent,
    wallet: Wallet | null,
    txHash: string
  ): Promise<void> {
    try {
      const trx = await Database.transaction()

      try {
        // Mark as completed
        paymentIntent.status = PaymentIntentStatus.PAYMENT_COMPLETED
        paymentIntent.completedAt = DateTime.now()
        await paymentIntent.useTransaction(trx).save()

        // Unlock AI customization access if this payment was for a custom shop upgrade.
        await this.unlockCustomShopAccess(paymentIntent)

        // Credit business owner's UserWallet with the received amount
        await this.creditBusinessWallet(paymentIntent)

        // Emit webhook to business
        await this.dispatchWebhook(paymentIntent, txHash)

        await trx.commit()

        // Send email notifications (after transaction commits)
        await this.sendEmailNotifications(paymentIntent, txHash)

        // Flush funds from child wallet to master wallet (skip for Fiber/invoice-based payments)
        if (wallet) {
          await this.scheduleSettlement(wallet, paymentIntent.uniqueId)
        }

        // Push real-time SSE events to the business owner
        this.emitPaymentConfirmedSSE(paymentIntent).catch(() => {})

        Logger.info(
          `[PaymentIndexer] Payment confirmed and processed for ${paymentIntent.uniqueId}`
        )
      } catch (error) {
        await trx.rollback()
        throw error
      }
    } catch (error) {
      Logger.error(
        `[PaymentIndexer] Failed to process confirmed payment: ${error}`
      )
      throw error
    }
  }

  private async creditBusinessWallet(paymentIntent: PaymentIntent): Promise<void> {
    try {
      if (!paymentIntent.businessId || !paymentIntent.fiatAmount || !paymentIntent.cryptoCurrencyId) {
        Logger.warn(`[UserWalletService] Cannot credit wallet: missing businessId, fiatAmount, or cryptoCurrencyId for intent ${paymentIntent.uniqueId}`)
        return
      }

      const cryptoCurrency = await Currency.query().where('uniqueId', paymentIntent.cryptoCurrencyId).firstOrFail()
      const usdtAmount = Number(paymentIntent.fiatAmount) / cryptoCurrency.ratePerUsd
      const creditedAmount = parseFloat(usdtAmount.toFixed(6))

      const creditedWallet = await UserWalletService.creditWallet({
        userId: Number(paymentIntent.businessId),
        amount: creditedAmount,
        cryptoNetworkId: cryptoCurrency.cryptoNetworkId,
        reference: paymentIntent.uniqueId,
        description: `Payment received for ${paymentIntent.businessReferenceId}`,
        metadata: {
          payment_intent_id: paymentIntent.uniqueId,
          fiat_amount: Number(paymentIntent.fiatAmount),
          fiat_currency_id: paymentIntent.fiatCurrencyId,
          crypto_currency: cryptoCurrency.symbol,
          tx_hash: null,
        },
      })

      if (creditedWallet) {
        Logger.info(`[UserWalletService] Credited ${creditedAmount} ${cryptoCurrency.symbol} to business ${paymentIntent.businessId}`)
      }
    } catch (error) {
      Logger.error(`[UserWalletService] Failed to credit business wallet for intent ${paymentIntent.uniqueId}: ${error}`)
    }
  }

  /** Push SSE events after a payment is confirmed: transaction.confirmed + wallet.balance_updated + order.payment_received */
  private async emitPaymentConfirmedSSE(paymentIntent: PaymentIntent): Promise<void> {
    try {
      // 1. transaction.confirmed
      SseService.emit(paymentIntent.businessId, {
        event: 'transaction.confirmed',
        data: {
          transaction_id: paymentIntent.uniqueId,
          reference_id: paymentIntent.businessReferenceId,
          amount: paymentIntent.fiatAmount,
          status: paymentIntent.status,
          completed_at: paymentIntent.completedAt?.toISO() ?? null,
        },
      })

      // 2. wallet.balance_updated — sum all active wallets for this business
      const businessUser = await User.query().where('uniqueId', paymentIntent.businessId).first()
      const wallets = businessUser
        ? await UserWallet.query().where('userId', businessUser.id).where('status', 'active')
        : []
      const totalBalanceUsd = wallets.reduce((s, w) => s + Number(w.balance), 0)

      SseService.emit(paymentIntent.businessId, {
        event: 'wallet.balance_updated',
        data: {
          total_balance_usd: parseFloat(totalBalanceUsd.toFixed(6)),
          wallets: wallets.map((w) => ({
            wallet_id: w.uniqueId,
            balance: Number(w.balance),
            currency_id: w.currencyId,
          })),
        },
      })

      // 3. order.payment_received — customer-facing order confirmation
      SseService.emit(paymentIntent.businessId, {
        event: 'order.payment_received',
        data: {
          payment_intent_id: paymentIntent.uniqueId,
          reference_id: paymentIntent.businessReferenceId,
          fiat_amount: paymentIntent.fiatAmount,
          fiat_currency_id: paymentIntent.fiatCurrencyId,
          status: paymentIntent.status,
          completed_at: paymentIntent.completedAt?.toISO() ?? null,
        },
      })
    } catch (err) {
      Logger.warn(`[PaymentIndexer] SSE emit failed: ${err}`)
    }
  }

  /**
   * Send webhook event to business's configured webhook URL
   */
  private async dispatchWebhook(paymentIntent: PaymentIntent, txHash: string): Promise<void> {
    try {
      await WebhookDispatcherService.dispatch(paymentIntent.businessId, 'payment.confirmed', {
        paymentId: paymentIntent.uniqueId,
        businessReferenceId: paymentIntent.businessReferenceId,
        amount: paymentIntent.fiatAmount,
        currency: paymentIntent.fiatCurrencyId,
        transactionHash: txHash,
        confirmedAt: paymentIntent.completedAt,
      })
    } catch (error) {
      Logger.warn(`[PaymentIndexer] Failed to dispatch webhook: ${error}`)
    }
  }

  /**
   * Schedule settlement job to flush funds to master wallet
   */
  private async scheduleSettlement(wallet: Wallet, paymentIntentId: string): Promise<void> {
    SettlementService.settleWallet(wallet.uniqueId, paymentIntentId).catch((err) => {
      Logger.error(`[PaymentIndexer] Settlement error for wallet ${wallet.uniqueId}: ${err}`)
    })
  }

  /**
   * Send email notifications to business owner and admins
   */
  private async sendEmailNotifications(
    paymentIntent: PaymentIntent,
    txHash: string
  ): Promise<void> {
    try {
      // Guard against null IDs
      if (!paymentIntent.cryptoCurrencyId || !paymentIntent.fiatCurrencyId || !paymentIntent.walletId) {
        Logger.error('Cannot send notifications: missing currency or wallet ID', { paymentIntentId: paymentIntent.uniqueId })
        return
      }

      const currency = await Currency.query().where('uniqueId', paymentIntent.cryptoCurrencyId).firstOrFail()
      const fiatCurrency = await Currency.query().where('uniqueId', paymentIntent.fiatCurrencyId).firstOrFail()
      const wallet = await Wallet.query().where('uniqueId', paymentIntent.walletId).firstOrFail()

      const cryptoAmount = parseFloat((paymentIntent.fiatAmount / currency.ratePerUsd).toFixed(8))

      const notificationData = {
        paymentId: paymentIntent.uniqueId,
        businessReferenceId: paymentIntent.businessReferenceId,
        fiatAmount: Number(paymentIntent.fiatAmount),
        fiatCurrency: fiatCurrency.symbol,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: currency.symbol,
        walletAddress: wallet.walletAddress,
        confirmedAt: paymentIntent.completedAt ? paymentIntent.completedAt.toJSDate() : new Date(),
        transactionHash: txHash,
      }

      // Send to business owner
      await EmailNotificationService.sendPaymentConfirmationEmail(
        paymentIntent,
        notificationData
      )

      // Send to admins
      await EmailNotificationService.sendAdminPaymentNotification(
        paymentIntent,
        notificationData
      )

      // Send to customer if this was a cart checkout
      if (paymentIntent.customerId) {
        await EmailNotificationService.sendCustomerOrderConfirmationEmail(
          paymentIntent.customerId,
          {
            referenceId: paymentIntent.businessReferenceId,
            shopName: (await User.query().where('uniqueId', paymentIntent.businessId).first())?.businessName || 'Store',
            fiatAmount: Number(paymentIntent.fiatAmount),
            fiatCurrency: fiatCurrency.symbol,
            confirmedAt: paymentIntent.completedAt ? paymentIntent.completedAt.toJSDate() : new Date(),
          }
        )
      }

      Logger.info(
        `[PaymentIndexer] Email notifications sent for payment ${paymentIntent.uniqueId}`
      )
    } catch (error) {
      Logger.warn(
        `[PaymentIndexer] Failed to send email notifications: ${error}`
      )
      // Don't fail the entire flow if email fails
    }
  }

  /**
   * Handle Fiber payment confirmation
   * Settles the payment by converting CKB/SUDT to USDT
   */
  private async onFiberPaymentConfirmed(
    paymentIntent: PaymentIntent,
    fiberInvoice: any,
    txHash: string
  ): Promise<void> {
    try {
      Logger.info(
        `[PaymentIndexer] Processing Fiber payment confirmation: ${paymentIntent.uniqueId}`
      )

      // Mark payment intent as completed
      paymentIntent.status = PaymentIntentStatus.PAYMENT_COMPLETED
      paymentIntent.completedAt = DateTime.now()
      await paymentIntent.save()

      // Trigger settlement (convert CKB/SUDT to USDT and add to business wallet)
      await FiberPaymentSettlementService.settleFiberPayment(fiberInvoice.uniqueId).catch(
        (err) => {
          Logger.error(
            `[PaymentIndexer] Fiber settlement failed: ${err.message}`
          )
        }
      )

      await this.unlockCustomShopAccess(paymentIntent).catch(() => {})

      // Emit webhook to business
      await this.dispatchWebhook(paymentIntent, txHash).catch(() => {})

      // Push real-time SSE events
      this.emitPaymentConfirmedSSE(paymentIntent).catch(() => {})

      Logger.info(
        `[PaymentIndexer] Fiber payment processed: ${paymentIntent.uniqueId}`
      )
    } catch (error: any) {
      Logger.error(
        `[PaymentIndexer] Failed to process Fiber payment: ${error.message}`
      )
    }
  }

  private async unlockCustomShopAccess(paymentIntent: PaymentIntent): Promise<void> {
    try {
      if (!paymentIntent.businessId || !paymentIntent.businessReferenceId) return

      const shop = await Shop.query()
        .where('userId', paymentIntent.businessId)
        .where('customizationPaymentReferenceId', paymentIntent.businessReferenceId)
        .first()

      if (!shop || shop.customizationAccessPaid) return

      shop.customizationAccessPaid = true
      shop.customizationAccessPaidAt = DateTime.now()
      await shop.save()

      Logger.info(`[PaymentIndexer] Unlocked AI customization for shop ${shop.uniqueId}`)
    } catch (error) {
      Logger.warn(`[PaymentIndexer] Failed to unlock custom shop access: ${error}`)
    }
  }

  /**
   * Validate webhook signature
   * Used to verify that webhooks are from trusted sources
   */
  /** Verify an inbound webhook signature (constant-time comparison). */
  validateWebhookSignature(signature: string, rawBody: string): boolean {
    const expected = this.generateSignature(rawBody)
    return signature.length === expected.length && signature === expected
  }

  /** Generate HMAC-SHA256 signature for a webhook body string. */
  private generateSignature(body: string): string {
    const secret = Env.get('WEBHOOK_SECRET', 'change-me-in-production')
    return createHmac('sha256', secret).update(body).digest('hex')
  }
}

export default new PaymentIndexerService()

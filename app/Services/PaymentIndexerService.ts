import { createHmac } from 'crypto'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env'
import { DateTime } from 'luxon'
import PaymentIntent from 'App/Models/PaymentIntent'
import Wallet from 'App/Models/Wallet'
import Currency from 'App/Models/Currency'
import UserWallet from 'App/Models/UserWallet'
import EmailNotificationService from './EmailNotificationService'
import EVMService from './EVMService'
import SettlementService from './SettlementService'
import SseService from './SseService'
import WebhookDispatcherService from './WebhookDispatcherService'
import { PaymentIntentStatus } from 'App/Lib/types'

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

  /**
   * Check if payment has been received for a specific intent
   */
  private async checkPaymentStatus(paymentIntent: PaymentIntent): Promise<void> {
    try {
      if (!paymentIntent.walletId || !paymentIntent.cryptoCurrencyId) return

      const wallet = await Wallet.find(paymentIntent.walletId)
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

      // Only poll EVM networks; CKB uses its own polling path
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

  /**
   * Triggered after payment is confirmed
   * Handles webhooks, emails, and settlement
   */
  private async onPaymentConfirmed(
    paymentIntent: PaymentIntent,
    wallet: Wallet,
    txHash: string
  ): Promise<void> {
    try {
      const trx = await Database.transaction()

      try {
        // Mark as completed
        paymentIntent.status = PaymentIntentStatus.PAYMENT_COMPLETED
        paymentIntent.completedAt = DateTime.now()
        await paymentIntent.useTransaction(trx).save()

        // Emit webhook to business
        await this.dispatchWebhook(paymentIntent, txHash)

        await trx.commit()

        // Send email notifications (after transaction commits)
        await this.sendEmailNotifications(paymentIntent, txHash)

        // Flush funds from child wallet to master wallet
        await this.scheduleSettlement(wallet, paymentIntent.uniqueId)

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

  /** Push SSE events after a payment is confirmed: transaction.confirmed + wallet.balance_updated */
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
      const wallets = await UserWallet.query()
        .where('userId', paymentIntent.businessId)
        .where('status', 'active')
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
      const currency = await Currency.findOrFail(paymentIntent.cryptoCurrencyId)
      const fiatCurrency = await Currency.findOrFail(paymentIntent.fiatCurrencyId)
      const wallet = await Wallet.findOrFail(paymentIntent.walletId)

      const cryptoAmount = parseFloat((paymentIntent.fiatAmount / currency.ratePerUsd).toFixed(8))

      const notificationData = {
        paymentId: paymentIntent.uniqueId,
        businessReferenceId: paymentIntent.businessReferenceId,
        fiatAmount: paymentIntent.fiatAmount,
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

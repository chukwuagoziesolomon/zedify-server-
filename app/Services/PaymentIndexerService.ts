import { ethers } from 'ethers'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import PaymentIntent from 'App/Models/PaymentIntent'
import Wallet from 'App/Models/Wallet'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Currency from 'App/Models/Currency'
import EmailNotificationService from './EmailNotificationService'
import { PaymentIntentStatus } from 'App/Lib/types'

interface WebhookPayload {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  blockNumber: number
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
        .where('address', payload.toAddress)
        .where('status', 'active')
        .firstOrFail()

      // Find payment intent for this wallet
      const paymentIntent = await PaymentIntent.query()
        .where('walletId', wallet.id)
        .whereIn('status', [PaymentIntentStatus.PAYMENT_CREATED, PaymentIntentStatus.AWAITING_CONFIRMATION])
        .firstOrFail()

      // Chain validation (optional - can skip for now)
      // const cryptoNetwork = await CryptoNetwork.query()
      //   .where('chainKey', payload.chainId.toString())
      //   .firstOrFail()

      // Verify transaction amount matches expected crypto amount
      const expectedCryptoAmount = paymentIntent.feeInCrypto
      const receivedAmount = ethers.formatEther(payload.amount)

      if (!expectedCryptoAmount || parseFloat(receivedAmount) < expectedCryptoAmount * 0.99) {
        // Allow 1% tolerance for fee variations
        Logger.warn(
          `[PaymentIndexer] Amount mismatch. Expected: ${expectedCryptoAmount}, Received: ${receivedAmount}`
        )
        return
      }

      // Update payment intent with received timestamp
      paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
      paymentIntent.receivedPaymentAt = DateTime.now()
      await paymentIntent.save()

      Logger.info(
        `[PaymentIndexer] Payment confirmed for intent ${paymentIntent.uniqueId}`
      )

      // Trigger downstream processes
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
  private async checkPaymentStatus(
    paymentIntent: PaymentIntent
  ): Promise<void> {
    try {
      if (!paymentIntent.walletId) {
        return
      }

      // Load wallet and network
      const wallet = await Wallet.find(paymentIntent.walletId)
      if (!wallet) {
        Logger.warn(`[PaymentIndexer] Wallet not found for intent ${paymentIntent.uniqueId}`)
        return
      }

      const network = await CryptoNetwork.find(wallet.cryptoNetworkId)
      if (!network) {
        Logger.warn(`[PaymentIndexer] Network not found for wallet ${wallet.id}`)
        return
      }

      // Get RPC provider
      const provider = new ethers.JsonRpcProvider(network.rpcUrl)

      // Get wallet balance
      const balance = await provider.getBalance(wallet.walletAddress)
      const balanceInEther = parseFloat(ethers.formatEther(balance))

      const expectedAmount = paymentIntent.feeInCrypto || 0

      // If balance meets expected amount, mark as confirmed
      if (balanceInEther >= expectedAmount * 0.99) {
        // 1% tolerance
        Logger.info(
          `[PaymentIndexer] Found payment for intent ${paymentIntent.uniqueId} on ${network.name}`
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

        // Schedule settlement (flush funds to master wallet)
        await this.scheduleSettlement(wallet)

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

  /**
   * Send webhook event to business's configured webhook URL
   */
  private async dispatchWebhook(
    paymentIntent: PaymentIntent,
    txHash: string
  ): Promise<void> {
    try {
      const business = await Business.findOrFail(paymentIntent.businessId)
      const setting = await business
        .related('settings')
        .firstOrFail()

      // Get webhook URL based on environment
      const environment = process.env.APP_ENV === 'production' ? 'LIVE' : 'TEST'
      const webhookUrl =
        environment === 'LIVE'
          ? setting.liveWebhookUrl
          : setting.testWebhookUrl

      if (!webhookUrl) {
        Logger.warn(
          `[PaymentIndexer] No webhook URL configured for business ${business.id}`
        )
        return
      }

      const payload = {
        event: 'payment.confirmed',
        data: {
          paymentId: paymentIntent.uniqueId,
          businessReferenceId: paymentIntent.businessReferenceId,
          amount: paymentIntent.fiatAmount,
          currency: paymentIntent.fiatCurrencyId,
          transactionHash: txHash,
          confirmedAt: paymentIntent.completedAt,
        },
      }

      // Send webhook with retries
      await this.sendWebhookWithRetry(webhookUrl, payload, 3)
    } catch (error) {
      Logger.warn(`[PaymentIndexer] Failed to dispatch webhook: ${error}`)
      // Don't fail the entire flow if webhook fails
    }
  }

  /**
   * Send webhook with exponential backoff retry
   */
  private async sendWebhookWithRetry(
    url: string,
    payload: any,
    retries: number = 3
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.generateSignature(payload),
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          Logger.info(`[PaymentIndexer] Webhook sent successfully to ${url}`)
          return
        }

        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        if (i === retries - 1) {
          Logger.error(
            `[PaymentIndexer] Webhook failed after ${retries} retries: ${error}`
          )
          throw error
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Schedule settlement job to flush funds to master wallet
   */
  private async scheduleSettlement(wallet: Wallet): Promise<void> {
    // TODO: Queue a settlement job (e.g., Bull Queue, Bree, or database-backed scheduler)
    // For now, just log intent
    Logger.info(
      `[PaymentIndexer] Scheduled settlement for wallet ${wallet.id}`
    )
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
  validateWebhookSignature(signature: string, payload: string): boolean {
    const crypto = require('crypto')
    const secret = process.env.WEBHOOK_SECRET || 'default-secret'
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    return signature === expectedSignature
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: any): string {
    const crypto = require('crypto')
    const secret = process.env.WEBHOOK_SECRET || 'default-secret'
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return hmac.digest('hex')
  }
}

export default new PaymentIndexerService()

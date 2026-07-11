import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import FiberInvoice from 'App/Models/FiberInvoice'
import UserWallet from 'App/Models/UserWallet'
import User from 'App/Models/User'
import BusinessFiberSetting from 'App/Models/BusinessFiberSetting'
import SudtService from './SudtService'
import ConversionService from './ConversionService'
import EmailNotificationService from './EmailNotificationService'
import SseService from './SseService'
import { PaymentIntentStatus } from 'App/Lib/types'

export interface SettlementResult {
  success: boolean
  fiberInvoiceId: string
  paymentIntentId: string
  amountCkb?: number
  amountUsdt?: number
  message: string
  transferId?: string
}

class FiberPaymentSettlementServiceClass {
  private emailNotifier = EmailNotificationService

  /**
   * Settle a Fiber payment:
   * 1. Get payment details
   * 2. Convert CKB/SUDT to USDT if needed
   * 3. Add to business wallet
   * 4. Trigger email notification
   */
  async settleFiberPayment(fiberInvoiceId: string): Promise<SettlementResult> {
    const trx = await Database.transaction()

    try {
      Logger.info(`[FiberSettlement] Settling payment: ${fiberInvoiceId}`)

      // Get Fiber invoice
      const fiberInvoice = await FiberInvoice.query(trx)
        .where('uniqueId', fiberInvoiceId)
        .preload('paymentIntent', (q) => q.useTransaction(trx))
        .first()

      if (!fiberInvoice) {
        throw new Error(`Fiber invoice not found: ${fiberInvoiceId}`)
      }

      const paymentIntent = fiberInvoice.paymentIntent
      if (!paymentIntent) {
        throw new Error(`Payment intent not found for invoice: ${fiberInvoiceId}`)
      }

      // Get business (sender of payment intent)
      const business = await User.query(trx)
        .where('uniqueId', paymentIntent.businessId)
        .first()
      if (!business) {
        throw new Error(`Business not found: ${paymentIntent.businessId}`)
      }

      // Get business wallet
      const businessWallet = await UserWallet.query(trx)
        .where('userId', business.id)
        .where('status', 'active')
        .firstOrFail()

      let amountCkb = fiberInvoice.amountCkb || 0
      let amountUsdt = 0
      let conversionRate = 1

      // Determine currency and calculate USDT equivalent
      if (fiberInvoice.currency === 'CKB' || !fiberInvoice.currency) {
        // Native CKB payment
        const ckbToUsd = await ConversionService.convertCkbToUsd(amountCkb)
        amountUsdt = parseFloat(ckbToUsd.toFixed(6))
        conversionRate = amountUsdt / amountCkb

        Logger.info(
          `[FiberSettlement] CKB to USDT: ${amountCkb} CKB = ${amountUsdt} USDT @ rate ${conversionRate}`
        )
      } else if (fiberInvoice.sudtTypeScript) {
        // SUDT token payment
        const sudtAmount = fiberInvoice.amountSudt || 0
        const conversion = await SudtService.convertSudtToUsdt(
          sudtAmount,
          fiberInvoice.sudtTypeScript
        )
        amountUsdt = conversion.toAmount
        conversionRate = conversion.exchangeRate

        Logger.info(
          `[FiberSettlement] ${fiberInvoice.currency} to USDT: ${sudtAmount} ${fiberInvoice.currency} = ${amountUsdt} USDT`
        )
      }

      // Deduct platform fee (5%)
      const platformFee = parseFloat((amountUsdt * 0.05).toFixed(6))
      const amountToReceive = parseFloat((amountUsdt - platformFee).toFixed(6))

      Logger.info(
        `[FiberSettlement] Fee: ${platformFee} USDT, Business receives: ${amountToReceive} USDT`
      )

      // Add to business wallet
      businessWallet.balance = parseFloat(
        (Number(businessWallet.balance) + amountToReceive).toFixed(6)
      )
      businessWallet.totalFiberReceived = parseFloat(
        (Number(businessWallet.totalFiberReceived || 0) + amountToReceive).toFixed(6)
      )
      await businessWallet.useTransaction(trx).save()

      // Update PaymentIntent status to completed
      paymentIntent.status = PaymentIntentStatus.PAYMENT_COMPLETED
      paymentIntent.completedAt = DateTime.now()
      await paymentIntent.useTransaction(trx).save()

      // Commit transaction
      await trx.commit()

      // Send notifications asynchronously
      this.sendSettlementNotifications(business, fiberInvoice, amountUsdt, platformFee)
        .catch((err) => {
          Logger.error(
            `[FiberSettlement] Notification failed: ${err.message}`
          )
        })

      // Send SSE update to business
      SseService.emit(paymentIntent.businessId, {
        event: 'payment.completed',
        data: {
          payment_id: paymentIntent.uniqueId,
          amount_received: amountToReceive,
          currency: 'USDT',
          timestamp: DateTime.now().toISO(),
        },
      })

      Logger.info(
        `[FiberSettlement] Payment settled: ${fiberInvoiceId}, Business received: ${amountToReceive} USDT`
      )

      return {
        success: true,
        fiberInvoiceId,
        paymentIntentId: paymentIntent.uniqueId,
        amountCkb,
        amountUsdt: amountToReceive,
        message: `Payment settled. Business received ${amountToReceive} USDT.`,
      }
    } catch (error) {
      await trx.rollback()
      Logger.error(`[FiberSettlement] Settlement failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Handle auto-conversion for business
   * If auto-convert enabled and threshold reached, convert CKB to USDT and payout
   */
  async handleAutoConversion(businessId: string): Promise<SettlementResult | null> {
    try {
      Logger.info(`[FiberSettlement] Checking auto-conversion for business: ${businessId}`)

      // Get business Fiber settings
      const fiberSetting = await BusinessFiberSetting.query()
        .where('businessId', businessId)
        .first()

      if (!fiberSetting || !fiberSetting.autoConvertDaily) {
        return null
      }

      // Get business wallet
      const business = await User.query().where('uniqueId', businessId).first()
      if (!business) return null

      const wallet = await UserWallet.query()
        .where('userId', business.id)
        .where('status', 'active')
        .first()

      if (!wallet || Number(wallet.balance) < fiberSetting.autoConvertThreshold) {
        return null
      }

      // Convert to USDT
      const conversionResult = await ConversionService.convertCkbToUsd(
        Number(wallet.balance)
      )
      const usdtAmount = parseFloat(conversionResult.toFixed(6))

      // Trigger payout via PayoutService or TransferService
      if (usdtAmount > 0) {
        Logger.info(
          `[FiberSettlement] Auto-converting ${wallet.balance} CKB to ${usdtAmount} USDT for business: ${businessId}`
        )

        // Update last conversion time
        fiberSetting.lastConvertedAt = DateTime.now()
        fiberSetting.totalConvertedUsd = parseFloat(
          (Number(fiberSetting.totalConvertedUsd) + usdtAmount).toFixed(6)
        )
        await fiberSetting.save()

        return {
          success: true,
          fiberInvoiceId: 'auto-conversion',
          paymentIntentId: '',
          amountCkb: Number(wallet.balance),
          amountUsdt: usdtAmount,
          message: `Auto-converted ${wallet.balance} CKB to ${usdtAmount} USDT`,
        }
      }

      return null
    } catch (error) {
      Logger.error(`[FiberSettlement] Auto-conversion failed: ${error.message}`)
      return null
    }
  }

  /**
   * Send settlement notification emails
   */
  private async sendSettlementNotifications(
    business: User,
    fiberInvoice: FiberInvoice,
    amountUsdt: number,
    platformFee: number
  ): Promise<void> {
    try {
      const amountToReceive = amountUsdt - platformFee

      // Send Fiber payment email notification
      await this.emailNotifier.sendFiberPaymentReceivedEmail(
        String(business.uniqueId),
        fiberInvoice.uniqueId,
        fiberInvoice.paymentHash || 'pending',
        fiberInvoice.amountCkb || fiberInvoice.amountSudt || 0,
        fiberInvoice.currency || 'CKB',
        amountUsdt,
        platformFee,
        amountToReceive,
        fiberInvoice.description,
        `https://dashboard.paymentsystem.com/business/payments/${fiberInvoice.uniqueId}`
      )

      Logger.info(`[FiberSettlement] Notification sent to ${business.email}`)
    } catch (error) {
      Logger.error(`[FiberSettlement] Failed to send notification: ${error.message}`)
    }
  }

  /**
   * Get settlement history for business
   */
  async getSettlementHistory(businessId: string, limit: number = 50) {
    const invoices = await FiberInvoice.query()
      .where('businessId', businessId)
      .where('status', 'paid')
      .preload('paymentIntent')
      .orderBy('paidAt', 'desc')
      .limit(limit)

    return invoices.map((inv) => ({
      id: inv.uniqueId,
      payment_hash: inv.paymentHash,
      amount_ckb: inv.amountCkb,
      amount_sudt: inv.amountSudt,
      currency: inv.currency,
      description: inv.description,
      received_at: inv.paidAt,
      reference_id: inv.paymentIntent?.businessReferenceId,
    }))
  }

  /**
   * Calculate total received and settled amounts
   */
  async getSettlementStats(businessId: string) {
    const business = await User.query().where('uniqueId', businessId).first()
    if (!business) return null

    const wallet = await UserWallet.query()
      .where('userId', business.id)
      .where('status', 'active')
      .first()

    const settledInvoices = await FiberInvoice.query()
      .where('businessId', businessId)
      .where('status', 'paid')

    let totalCkbReceived = 0
    const sudtByType: Record<string, number> = {}

    for (const inv of settledInvoices) {
      if (inv.amountCkb) totalCkbReceived += inv.amountCkb
      if (inv.amountSudt) {
        const key = inv.currency || 'unknown'
        sudtByType[key] = (sudtByType[key] || 0) + inv.amountSudt
      }
    }

    return {
      wallet_balance_usdt: Number(wallet?.balance || 0),
      total_ckb_received: totalCkbReceived,
      total_sudt_received: sudtByType,
      total_payments_settled: settledInvoices.length,
    }
  }
}

export default new FiberPaymentSettlementServiceClass()

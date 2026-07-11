import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import crypto from 'crypto'
import { DateTime } from 'luxon'
import Transfer from 'App/Models/Transfer'
import { TransferStatus } from 'App/Models/Transfer'
import EmailNotificationService from 'App/Services/EmailNotificationService'

/**
 * PayoutWebhookController
 * Handles webhooks from Paystack/Moniepoint for transfer settlement confirmations
 * Updates transfer status based on settlement result
 */
export default class PayoutWebhookController {
  /**
   * POST /api/webhooks/payout/paystack
   * Handle Paystack transfer completion/failure webhooks
   * 
   * Webhook payload from Paystack:
   * {
   *   event: "transfer.success" | "transfer.failed" | "transfer.reversed",
   *   data: {
   *     reference: "transfer_code_xxxxx",
   *     status: "success" | "failed" | "reversed",
   *     transfer_code: "TRF_xxxxx",
   *     amount: 50000 (in kobo),
   *     recipient: {
   *       name: "John Doe",
   *       account_number: "1234567890"
   *     },
   *     reason?: "Insufficient funds"
   *   }
   * }
   */
  async handlePaystackWebhook({ request, response }: HttpContextContract) {
    try {
      const payload = request.body()

      // Verify webhook signature
      const signature = request.header('x-paystack-signature')
      if (!signature || !this.verifyPaystackSignature(payload, signature)) {
        Logger.warn('[PayoutWebhook] Invalid Paystack signature')
        return response.unauthorized({
          success: false,
          message: 'Invalid signature',
        })
      }

      Logger.info(
        `[PayoutWebhook] Received Paystack webhook: ${payload.event}`
      )

      const { event, data } = payload

      // Handle different webhook events
      switch (event) {
        case 'transfer.success':
          await this.handleTransferSuccess(data)
          break
        case 'transfer.failed':
          await this.handleTransferFailed(data)
          break
        case 'transfer.reversed':
          await this.handleTransferReversed(data)
          break
        default:
          Logger.info(
            `[PayoutWebhook] Ignoring unhandled event: ${event}`
          )
      }

      return response.ok({
        success: true,
        message: 'Webhook processed',
      })
    } catch (error) {
      Logger.error(`[PayoutWebhook] Webhook processing failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Webhook processing failed',
      })
    }
  }

  /**
   * Handle successful transfer
   * Update transfer status to completed
   */
  private async handleTransferSuccess(data: any): Promise<void> {
    try {
      // Extract transfer reference from our system (should be in the reference field)
      const transferCode = data.transfer_code || data.reference
      const transactionRef = data.reference

      Logger.info(
        `[PayoutWebhook] Processing successful transfer: ${transferCode}`
      )

      // Find transfer by bankTransferRef (which stores the Paystack transfer code)
      const transfer = await Transfer.query()
        .where('bankTransferRef', transferCode)
        .orWhere('uniqueId', transactionRef)
        .first()

      if (!transfer) {
        Logger.warn(
          `[PayoutWebhook] Transfer not found: ${transferCode}`
        )
        return
      }

      // Update transfer status
      transfer.status = TransferStatus.COMPLETED
      transfer.completedAt = DateTime.now()
      await transfer.save()

      Logger.info(
        `[PayoutWebhook] Transfer ${transfer.uniqueId} marked as completed`
      )

      // Send completion email
      try {
        await EmailNotificationService.sendTransferCompletedEmail(transfer)
      } catch (emailError) {
        Logger.warn(
          `[PayoutWebhook] Failed to send completion email: ${emailError}`
        )
      }
    } catch (error) {
      Logger.error(`[PayoutWebhook] Failed to handle transfer success: ${error}`)
      throw error
    }
  }

  /**
   * Handle failed transfer
   * Update transfer status to failed and refund USDT
   */
  private async handleTransferFailed(data: any): Promise<void> {
    try {
      const transferCode = data.transfer_code || data.reference
      const reason = data.reason || 'Bank transfer failed'

      Logger.info(
        `[PayoutWebhook] Processing failed transfer: ${transferCode}`
      )

      const transfer = await Transfer.query()
        .where('bankTransferRef', transferCode)
        .orWhere('uniqueId', transferCode)
        .first()

      if (!transfer) {
        Logger.warn(`[PayoutWebhook] Transfer not found: ${transferCode}`)
        return
      }

      // Update transfer status
      transfer.status = TransferStatus.FAILED
      await transfer.save()

      Logger.info(
        `[PayoutWebhook] Transfer ${transfer.uniqueId} marked as failed: ${reason}`
      )

      // Send failure email
      try {
        await EmailNotificationService.sendTransferFailedEmail(
          transfer,
          reason
        )
      } catch (emailError) {
        Logger.warn(
          `[PayoutWebhook] Failed to send failure email: ${emailError}`
        )
      }

      // TODO: Refund USDT to user wallet (create reverse entry)
      // This should be done carefully to maintain audit trail
    } catch (error) {
      Logger.error(`[PayoutWebhook] Failed to handle transfer failure: ${error}`)
      throw error
    }
  }

  /**
   * Handle transfer reversal (rare but possible)
   * Revert transfer status
   */
  private async handleTransferReversed(data: any): Promise<void> {
    try {
      const transferCode = data.transfer_code || data.reference
      const reason = data.reason || 'Bank transfer reversed'

      Logger.info(
        `[PayoutWebhook] Processing reversed transfer: ${transferCode}`
      )

      const transfer = await Transfer.query()
        .where('bankTransferRef', transferCode)
        .first()

      if (!transfer) {
        Logger.warn(`[PayoutWebhook] Transfer not found: ${transferCode}`)
        return
      }

      // Update status to failed (reversal is a type of failure)
      transfer.status = TransferStatus.FAILED
      await transfer.save()

      Logger.info(
        `[PayoutWebhook] Transfer ${transfer.uniqueId} marked as reversed: ${reason}`
      )

      // Send failure notification
      try {
        await EmailNotificationService.sendTransferFailedEmail(
          transfer,
          `Transfer reversed: ${reason}`
        )
      } catch (emailError) {
        Logger.warn(
          `[PayoutWebhook] Failed to send reversal email: ${emailError}`
        )
      }
    } catch (error) {
      Logger.error(
        `[PayoutWebhook] Failed to handle transfer reversal: ${error}`
      )
      throw error
    }
  }

  /**
   * Verify Paystack webhook signature
   * Paystack signs webhooks with HMAC-SHA512
   */
  private verifyPaystackSignature(
    payload: any,
    signature: string
  ): boolean {
    try {
      const secretKey = process.env.PAYSTACK_SECRET_KEY
      if (!secretKey) {
        Logger.warn('[PayoutWebhook] Paystack secret key not configured')
        return false
      }

      // Paystack signs the JSON body
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(JSON.stringify(payload))
        .digest('hex')

      return hash === signature
    } catch (error) {
      Logger.error(`[PayoutWebhook] Signature verification failed: ${error}`)
      return false
    }
  }

  /**
   * POST /api/webhooks/payout/health
   * Health check for webhook endpoint
   */
  async healthCheck({ response }: HttpContextContract) {
    return response.ok({
      success: true,
      message: 'Payout webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
    })
  }
}

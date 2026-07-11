import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import PaymentIndexerService from 'App/Services/PaymentIndexerService'

/**
 * PaymentWebhookController
 * Receives real-time payment confirmation events from blockchain indexers
 * (Alchemy, Tenderly, The Graph, etc.)
 */
export default class PaymentWebhookController {
  /**
   * Handle incoming webhook events from third-party payment indexers
   * POST /api/webhooks/payment
   */
  async handlePaymentEvent({ request, response }: HttpContextContract) {
    try {
      const payload = request.all()

      Logger.info(
        `[PaymentWebhook] Received event from webhook`
      )

      // Process the webhook payment
      // Parse the webhook payload based on source
      const paymentEvent = this.parseWebhookPayload(payload) 

      if (!paymentEvent) {
        Logger.warn('[PaymentWebhook] Could not parse webhook payload')
        return response.status(400).json({
          success: false,
          message: 'Invalid payload format',
        })
      }

      // Process the payment event asynchronously
      // Don't wait for completion - return 200 immediately
      PaymentIndexerService.handleWebhookEvent(paymentEvent).catch(
        (error) => {
          Logger.error(`[PaymentWebhook] Error processing payment: ${error}`)
        }
      )

      // Return 200 OK immediately to prevent retry loops
      return response.status(200).json({
        success: true,
        message: 'Webhook received',
        txHash: paymentEvent?.txHash || 'unknown',
      })
    } catch (error) {
      Logger.error(`[PaymentWebhook] Webhook processing failed: ${error}`)
      return response.status(400).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message,
      })
    }
  }

  /**
   * Fallback endpoint for direct payment polling
   * POST /api/webhooks/payment/poll
   */
  async pollPayments({ response }: HttpContextContract) {
    try {
      Logger.info('[PaymentWebhook] Manual polling triggered')

      // Trigger polling asynchronously
      PaymentIndexerService.pollPendingPayments().catch((error) => {
        Logger.error(`[PaymentWebhook] Polling error: ${error}`)
      })

      return response.status(200).json({
        success: true,
        message: 'Polling initiated',
      })
    } catch (error) {
      Logger.error(`[PaymentWebhook] Polling failed: ${error}`)
      return response.status(500).json({
        success: false,
        message: 'Polling failed',
        error: error.message,
      })
    }
  }

  /**
   * Parse webhook payload based on source
   * Supports: Alchemy, Tenderly, The Graph, custom
   */
  private parseWebhookPayload(payload: any) {
    try {
      // Alchemy format
      if (
        payload.event &&
        payload.event.activity &&
        Array.isArray(payload.event.activity)
      ) {
        const activity = payload.event.activity[0]
        return {
          txHash: activity.hash,
          fromAddress: activity.from,
          toAddress: activity.to,
          amount: activity.value || '0',
          blockNumber: parseInt(activity.blockNum) || 0,
          chainId: payload.event.chainId || 1,
        }
      }

      // Tenderly format
      if (payload.webhookId && payload.result) {
        const tx = payload.result
        return {
          txHash: tx.hash,
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: tx.value || '0',
          blockNumber: parseInt(tx.block_number) || 0,
          chainId: tx.chainId || 1,
        }
      }

      // Custom format
      if (
        (payload.transactionHash || payload.txHash) &&
        payload.walletAddress &&
        payload.amount
      ) {
        return {
          txHash: payload.transactionHash || payload.txHash,
          fromAddress: payload.from || '',
          toAddress: payload.walletAddress,
          amount: payload.amount.toString(),
          blockNumber: payload.blockNumber || 0,
          chainId: payload.chainId || 1,
        }
      }

      return null
    } catch (error) {
      Logger.warn(`[PaymentWebhook] Error parsing payload: ${error}`)
      return null
    }
  }

  /**
   * Health check endpoint for webhook service
   * GET /api/webhooks/payment/health
   */
  async health({ response }: HttpContextContract) {
    return response.status(200).json({
      success: true,
      status: 'healthy',
      service: 'PaymentWebhookService',
      timestamp: new Date().toISOString(),
    })
  }
}

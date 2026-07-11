import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import FiatDeposit from 'App/Models/FiatDeposit'
import PaystackService from 'App/Services/PaystackService'
import StablecoinConversionService from 'App/Services/StablecoinConversionService'

export default class PaystackWebhookController {
  /**
   * POST /api/webhooks/paystack
   * Paystack sends this on every transaction event — we only act on
   * charge.success, and we verify the signature before trusting anything.
   */
  public async handle({ request, response }: HttpContextContract) {
    const signature = request.header('x-paystack-signature', '')
    const rawBody = request.raw() ?? ''

    if (!signature || !PaystackService.verifySignature(signature, rawBody)) {
      Logger.warn('[PaystackWebhook] Invalid signature — rejecting')
      return response.unauthorized({ error: 'Invalid signature' })
    }

    // Acknowledge immediately, process async — mirrors the pattern already
    // used in PaymentIndexerService.handleWebhookEvent for the EVM path.
    response.ok({ received: true })

    const event = request.input('event')
    const data = request.input('data')

    if (event !== 'charge.success') {
      return
    }

    try {
      const deposit = await FiatDeposit.query().where('providerReference', data.reference).first()
      if (!deposit) {
        Logger.warn(`[PaystackWebhook] No deposit found for reference ${data.reference}`)
        return
      }

      const paidNaira = (data.amount ?? 0) / 100
      if (Math.abs(paidNaira - Number(deposit.nairaAmount)) > 0.5) {
        Logger.warn(
          `[PaystackWebhook] Amount mismatch for deposit ${deposit.uniqueId}. Expected ₦${deposit.nairaAmount}, got ₦${paidNaira}`
        )
        return
      }

      await StablecoinConversionService.handleFiatReceived(deposit.uniqueId)
    } catch (error) {
      Logger.error(`[PaystackWebhook] Processing failed: ${error}`)
    }
  }
}

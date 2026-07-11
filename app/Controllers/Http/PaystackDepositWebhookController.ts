import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import FiatDeposit from 'App/Models/FiatDeposit'
import PaystackChargeService from 'App/Services/PaystackChargeService'
import StablecoinConversionService from 'App/Services/StablecoinConversionService'

/**
 * PaystackDepositWebhookController
 *
 * Receives charge.success events from Paystack for fiat deposit flows.
 * Verifies the HMAC-SHA512 signature before processing.
 *
 * This is separate from PayoutWebhookController which handles Paystack
 * *transfer* events (outbound bank settlements). This controller handles
 * inbound *charge* events (fiat deposits / AI customization payments).
 *
 * Paystack sends:
 *   POST /api/webhooks/paystack/deposit
 *   Headers: x-paystack-signature: <sha512 hmac>
 *   Body: { event: "charge.success", data: { reference, amount, ... } }
 */
export default class PaystackDepositWebhookController {
  public async handle({ request, response }: HttpContextContract) {
    const signature = request.header('x-paystack-signature') ?? ''
    const rawBody = request.raw() ?? ''

    if (!signature || !PaystackChargeService.verifySignature(signature, rawBody)) {
      Logger.warn('[PaystackDepositWebhook] Invalid signature — rejecting')
      return response.unauthorized({ error: 'Invalid signature' })
    }

    // Acknowledge immediately — Paystack retries if it does not get 200 within ~30s
    response.ok({ received: true })

    const event = request.input('event')
    const data = request.input('data')

    if (event !== 'charge.success') {
      return
    }

    try {
      const deposit = await FiatDeposit.query()
        .where('providerReference', data.reference)
        .first()

      if (!deposit) {
        Logger.warn(
          `[PaystackDepositWebhook] No deposit found for reference ${data.reference}`
        )
        return
      }

      // Belt-and-braces: confirm amount matches what we recorded
      const paidNaira = (data.amount ?? 0) / 100
      if (Math.abs(paidNaira - Number(deposit.nairaAmount)) > 1) {
        Logger.warn(
          `[PaystackDepositWebhook] Amount mismatch for deposit ${deposit.uniqueId}. ` +
          `Expected ₦${deposit.nairaAmount}, got ₦${paidNaira}`
        )
        return
      }

      await StablecoinConversionService.handleFiatReceived(deposit.uniqueId)
    } catch (error) {
      Logger.error(`[PaystackDepositWebhook] Processing failed: ${error}`)
    }
  }
}

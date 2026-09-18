import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { genRandomUuid, formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import Currency from 'App/Models/Currency'
import PaymentIntent from 'App/Models/PaymentIntent'
import { PaymentIntentStatus, CurrencyType } from 'App/Lib/types'
import Env from '@ioc:Adonis/Core/Env'

export default class ApiCheckoutController {
  public async create({ request, response }: HttpContextContract) {
    try {
      const context = request.ctx as HttpContextContract & {
        apiBusinessId?: string
        apiEnvironment?: 'LIVE' | 'TEST'
      }
      const businessId = context.apiBusinessId
      if (!businessId) throw new Error('API merchant context is missing')

      const amount = Number(request.input('amount'))
      const currencySymbol = String(request.input('currency', '')).trim().toUpperCase()
      const referenceId = String(request.input('reference_id') || genRandomUuid()).trim()
      const customerEmail = request.input('customer_email') || null
      const metadata = request.input('metadata') || {}

      if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be greater than zero')
      if (!currencySymbol) throw new Error('currency is required')
      if (!referenceId) throw new Error('reference_id cannot be empty')
      if (typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('metadata must be an object')

      const currency = await Currency.query()
        .where('symbol', currencySymbol)
        .where('type', CurrencyType.FIAT)
        .first()
      if (!currency) throw new Error(`Unsupported fiat currency: ${currencySymbol}`)

      const existing = await PaymentIntent.query()
        .where('businessId', businessId)
        .where('businessReferenceId', referenceId)
        .first()
      if (existing) throw new Error('reference_id has already been used')

      const intent = await PaymentIntent.create({
        uniqueId: genRandomUuid(),
        businessId,
        businessReferenceId: referenceId,
        fiatCurrencyId: currency.uniqueId,
        fiatAmount: amount,
        status: PaymentIntentStatus.PAYMENT_CREATED,
        customerEmail,
        metadata: {
          ...metadata,
          integration: 'api',
          environment: context.apiEnvironment,
          order_status: 'pending',
        },
      })

      const checkoutUrl = String(
        Env.get('HOSTED_CHECKOUT_URL', Env.get('CLIENT_URL', ''))
      ).replace(/\/$/, '')
      if (!checkoutUrl) throw new Error('HOSTED_CHECKOUT_URL is not configured')

      return response.created(formatSuccessMessage('Checkout session created', {
        session_id: intent.uniqueId,
        payment_intent_id: intent.uniqueId,
        reference_id: referenceId,
        checkout_url: `${checkoutUrl}/checkout/confirm/${referenceId}`,
        status: intent.status,
        environment: context.apiEnvironment,
        amount,
        currency: currency.symbol,
        customer_email: customerEmail,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}
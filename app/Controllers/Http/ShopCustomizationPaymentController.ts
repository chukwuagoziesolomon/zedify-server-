import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage, genRandomUuid } from 'App/helpers/utils'
import RolesController from './RolesController'
import Shop from 'App/Models/Shop'
import FiatDeposit from 'App/Models/FiatDeposit'
import Currency from 'App/Models/Currency'
import User from 'App/Models/User'
import PaystackChargeService from 'App/Services/PaystackChargeService'

/**
 * ShopCustomizationPaymentController
 *
 * Handles the fiat-to-crypto payment flow that unlocks AI shop customization.
 *
 * Flow:
 *   1. POST /api/user/shop/customization/pay
 *      → creates a Paystack charge and returns a checkout URL + virtual account details
 *   2. User pays on Paystack
 *   3. Paystack fires charge.success webhook → /api/webhooks/paystack/deposit
 *   4. PaystackDepositWebhookController calls StablecoinConversionService
 *   5. Stablecoin is credited to user's preferred wallet
 *   6. Shop is unlocked for AI customization (shop.customizationAccessPaid = true)
 *   7. SSE pushes shop.customization_unlocked event to the frontend
 *
 * GET /api/user/shop/customization/status
 *   → returns current unlock state + deposit status for the frontend to poll
 */
export default class ShopCustomizationPaymentController extends RolesController {
  /**
   * POST /api/user/shop/customization/pay
   *
   * Initiates a Paystack fiat charge so the user can pay to unlock AI customization.
   *
   * Body:
   *   - amount_naira: number          — how much the user is paying in NGN
   *   - target_currency_id: string    — which stablecoin they want to receive (UUID from /api/currencies)
   */
  public async initiateCustomizationPayment({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const shop = await Shop.query().where('userId', userId).first()
      if (!shop) throw new Error('You must create a shop first.')
      if (shop.customizationAccessPaid) {
        return response.ok(
          formatSuccessMessage('AI customization is already unlocked for this shop', {
            unlocked: true,
            shop_id: shop.uniqueId,
          })
        )
      }

      const { amount_naira, target_currency_id } = request.only([
        'amount_naira',
        'target_currency_id',
      ])

      if (!amount_naira || Number(amount_naira) <= 0) {
        throw new Error('amount_naira must be greater than 0')
      }

      const currency = await Currency.query()
        .where('uniqueId', String(target_currency_id))
        .first()
      if (!currency) throw new Error('Invalid target_currency_id — currency not found')

      const user = await User.query().where('uniqueId', userId).firstOrFail()

      const reference = `shop-custom-${genRandomUuid()}`

      const deposit = await FiatDeposit.create({
        uniqueId: genRandomUuid(),
        userId: user.id,
        targetCurrencyId: currency.id,
        nairaAmount: Number(amount_naira),
        provider: 'paystack',
        providerReference: reference,
        status: 'pending',
        shopCustomizationId: shop.uniqueId,  // ties this deposit to the shop unlock
      })

      // Mark the shop's payment reference for indexer compatibility
      shop.customizationPaymentReferenceId = reference
      await shop.save()

      const charge = await PaystackChargeService.initializeCharge({
        email: user.email,
        amountNaira: Number(amount_naira),
        reference,
        metadata: {
          depositId: deposit.uniqueId,
          shopId: shop.uniqueId,
          currencySymbol: currency.symbol,
          purpose: 'shop_ai_customization',
        },
      })

      return response.ok(
        formatSuccessMessage('Payment initiated — complete on Paystack to unlock AI customization', {
          deposit_id: deposit.uniqueId,
          reference,
          amount_naira: Number(amount_naira),
          target_currency: currency.symbol,
          checkout_url: charge.authorizationUrl,
          access_code: charge.accessCode,
          shop_id: shop.uniqueId,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/user/shop/customization/status
   *
   * Returns the current unlock state and latest deposit status.
   * The frontend can poll this after the user pays on Paystack,
   * alongside listening to the SSE `shop.customization_unlocked` event.
   */
  public async customizationStatus({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const shop = await Shop.query().where('userId', userId).first()
      if (!shop) throw new Error('No shop found')

      // Find the most recent customization deposit for this shop
      const latestDeposit = await FiatDeposit.query()
        .where('shopCustomizationId', shop.uniqueId)
        .orderBy('createdAt', 'desc')
        .preload('targetCurrency')
        .first()

      return response.ok(
        formatSuccessMessage('Customization status', {
          shop_id: shop.uniqueId,
          unlocked: shop.customizationAccessPaid,
          unlocked_at: shop.customizationAccessPaidAt?.toISO() ?? null,
          latest_deposit: latestDeposit
            ? {
                deposit_id: latestDeposit.uniqueId,
                status: latestDeposit.status,
                amount_naira: latestDeposit.nairaAmount,
                credited_amount: latestDeposit.convertedAmount,
                currency: (latestDeposit as any).targetCurrency?.symbol ?? null,
                failure_reason: latestDeposit.failureReason,
                created_at: latestDeposit.createdAt?.toISO(),
                credited_at: latestDeposit.creditedAt?.toISO() ?? null,
              }
            : null,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Currency from 'App/Models/Currency'
import PaymentIntent from 'App/Models/PaymentIntent'
import User from 'App/Models/User'
import UserIdentity from 'App/Models/UserIdentity'
import RolesController from './RolesController'
import { PaymentIntentStatus } from 'App/Lib/types'

export default class CkbMetricsController extends RolesController {
  public async index({ auth, response }: HttpContextContract) {
    try {
      const businessId = this.allowOnlyLoggedInUsers(auth)
      const business = await User.query().where('uniqueId', businessId).firstOrFail()
      const intents = await PaymentIntent.query().where('businessId', businessId)
      const currencies = await Currency.query().preload('cryptoNetwork')
      const currencyMap = new Map(currencies.map((currency) => [currency.uniqueId, currency]))
      const ckbIntents = intents.filter((intent) => {
        const network = currencyMap.get(intent.cryptoCurrencyId || '')?.cryptoNetwork
        return network?.networkType === 'ckb'
      })
      const completedCkb = ckbIntents.filter((intent) => intent.status === PaymentIntentStatus.PAYMENT_COMPLETED)
      const fiberCompleted = completedCkb.filter((intent) => {
        const network = currencyMap.get(intent.cryptoCurrencyId || '')?.cryptoNetwork
        return network?.chainKey?.toLowerCase().includes('fiber')
      })
      const ckbCurrencies = new Set(ckbIntents.map((intent) => intent.cryptoCurrencyId).filter(Boolean))
      const totalCkbFiat = completedCkb.reduce((sum, intent) => sum + Number(intent.fiatAmount || 0), 0)
      const identitiesConnected = await UserIdentity.query()
        .where('userId', business.id)
        .where('provider', 'ccc')
        .count('* as total')

      return response.ok({
        error: false,
        data: {
          ccc_identities_connected: Number(identitiesConnected[0].$extras.total || 0),
          ckb_payment_intents_created: ckbIntents.length,
          ckb_payments_completed: completedCkb.length,
          fiber_payments_completed: fiberCompleted.length,
          ckb_payment_volume_fiat: totalCkbFiat,
          ckb_currencies_used: ckbCurrencies.size,
          payment_methods: {
            ckb: ckbIntents.length,
            other: intents.length - ckbIntents.length,
          },
        },
      })
    } catch (error) {
      return response.badRequest({ error: true, data: 'Unable to load CKB metrics', details: String(error) })
    }
  }
}

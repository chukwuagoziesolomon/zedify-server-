import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessCurrency from 'App/Models/BusinessCurrency'
import BusinessCurrencyValidator from 'App/Validators/BusinessCurrencyValidator'
import { formatSuccessMessage, formatErrorMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { BusinessCurrencyStatus, CurrencyType, CurrentEnvironment } from 'App/Lib/types'
import Currency from 'App/Models/Currency'
import BusinessSetting from 'App/Models/BusinessSetting'

export default class BusinessCurrencyController extends RolesController {
  // POST /api/user/currency/enable
  public async enable({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { currency_id } = await request.validate(BusinessCurrencyValidator)


      // Ensure the currency is of type 'crypto'
      const currency = await Currency.query().where('unique_id', currency_id).first()
      if (!currency || currency.type !== CurrencyType.CRYPTO) {
        throw new Error('Only crypto currencies can be enabled.')
      }

      // Upsert: enable currency for user
      const entry = await BusinessCurrency.updateOrCreate(
        { userId, currencyId: currency_id },
        { status: BusinessCurrencyStatus.ACTIVE }
      )

      return response.ok(formatSuccessMessage('Currency enabled', entry))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // POST /api/user/currency/disable
  public async disable({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { currency_id } = await request.validate(BusinessCurrencyValidator)

      const entry = await BusinessCurrency.query()
        .where('user_id', userId)
        .andWhere('currency_id', currency_id)
        .first()

      if (!entry) {
        return response.badRequest({ error: true, message: 'Currency not found' })
      }

      entry.status = BusinessCurrencyStatus.INACTIVE
      await entry.save()

      return response.ok(formatSuccessMessage('Currency disabled', entry))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * Static method to get all active currencies for a business (user).
   * Can be called from other classes/services.
   */
  public static async getActiveCurrenciesForBusiness(userId: string) {
    try {
      // 1. Get the business's current environment
      const businessSetting = await BusinessSetting.query().where('businessId', userId).first()
      if (!businessSetting) {
        console.error(`[BusinessCurrency] No business settings found for userId: ${userId}`)
        return [];
      }

      if (businessSetting.currentEnvironment === CurrentEnvironment.TEST) {
        // Return all crypto currencies on testnet
        const testCurrencies = await Currency.query()
          .where('type', CurrencyType.CRYPTO)
          .preload('cryptoNetwork')
        return testCurrencies.filter(c => c.cryptoNetwork && c.cryptoNetwork.isTestnet)
      } else {
        // LIVE: Return only enabled (active) business currencies on mainnet
        const businessCurrencies = await BusinessCurrency.query()
          .where('userId', userId)
          .andWhere('status', BusinessCurrencyStatus.ACTIVE)
        const currencyIds = businessCurrencies.map(bc => bc.currencyId)
        if (currencyIds.length === 0) {
          console.error(`[BusinessCurrency] No active business currencies found for userId: ${userId}`)
          return [];
        }
        const currencies = await Currency.query()
          .whereIn('unique_id', currencyIds)
          .where('type', CurrencyType.CRYPTO)
          .preload('cryptoNetwork')
        return currencies.filter(c => c.cryptoNetwork && !c.cryptoNetwork.isTestnet)
      }
    } catch (error) {
      console.error(`[BusinessCurrency] Error in getActiveCurrenciesForBusiness for userId: ${userId} -`, error?.message || error)
      return []
    }
  }
}

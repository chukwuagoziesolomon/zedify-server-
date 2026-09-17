import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import SettingsGeneralValidator from 'App/Validators/SettingsGeneralValidator'

export default class SettingsGeneralController extends RolesController {
  // GET /api/user/settings/general
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')
      const data = {
        fee_bearer: businessSetting.feeBearer || null,
        current_environment: businessSetting.currentEnvironment || null,
        payout_interval: businessSetting.payoutInterval || null,
        payout_type: businessSetting.payoutType || null,
        auto_settlement_enabled: businessSetting.autoSettlementEnabled || false,
        auto_settlement_time: businessSetting.autoSettlementTime || '18:00',
        payout_method: businessSetting.payoutMethod || 'wallet',
        payout_wallet_id: businessSetting.payoutWalletId || null,
        payout_currency_id: businessSetting.payoutCurrencyId || null,
        payout_bank_account_no: businessSetting.payoutBankAccountNo || null,
        payout_bank_name: businessSetting.payoutBankName || null,
        payout_account_name: businessSetting.payoutAccountName || null,
        payout_bank_code: businessSetting.payoutBankCode || null,
        last_payout_at: businessSetting.lastPayoutAt?.toISO() || null,
        last_payout_status: businessSetting.lastPayoutStatus || null,
      }
      response.status(200).json(formatSuccessMessage('Settings retrieved successfully', data))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  // POST /api/client/settings/general
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const payload = await request.validate(SettingsGeneralValidator)
      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')
      if (payload.fee_bearer) businessSetting.feeBearer = payload.fee_bearer
      if (payload.current_environment) businessSetting.currentEnvironment = payload.current_environment
      if (payload.payout_interval) businessSetting.payoutInterval = payload.payout_interval
      if (payload.payout_type) businessSetting.payoutType = payload.payout_type
      if (payload.auto_settlement_enabled !== undefined) businessSetting.autoSettlementEnabled = payload.auto_settlement_enabled
      if (payload.auto_settlement_time) businessSetting.autoSettlementTime = payload.auto_settlement_time
      if (payload.payout_method) businessSetting.payoutMethod = payload.payout_method
      if (payload.payout_wallet_id !== undefined) businessSetting.payoutWalletId = payload.payout_wallet_id || null
      if (payload.payout_currency_id !== undefined) businessSetting.payoutCurrencyId = payload.payout_currency_id || null
      if (payload.payout_bank_account_no !== undefined) businessSetting.payoutBankAccountNo = payload.payout_bank_account_no || null
      if (payload.payout_bank_name !== undefined) businessSetting.payoutBankName = payload.payout_bank_name || null
      if (payload.payout_account_name !== undefined) businessSetting.payoutAccountName = payload.payout_account_name || null
      if (payload.payout_bank_code !== undefined) businessSetting.payoutBankCode = payload.payout_bank_code || null
      await businessSetting.save()
      const data = {
        fee_bearer: businessSetting.feeBearer,
        current_environment: businessSetting.currentEnvironment,
        payout_interval: businessSetting.payoutInterval,
        payout_type: businessSetting.payoutType,
        auto_settlement_enabled: businessSetting.autoSettlementEnabled,
        auto_settlement_time: businessSetting.autoSettlementTime,
        payout_method: businessSetting.payoutMethod,
        payout_wallet_id: businessSetting.payoutWalletId,
        payout_currency_id: businessSetting.payoutCurrencyId,
        payout_bank_account_no: businessSetting.payoutBankAccountNo,
        payout_bank_name: businessSetting.payoutBankName,
        payout_account_name: businessSetting.payoutAccountName,
        payout_bank_code: businessSetting.payoutBankCode,
        last_payout_at: businessSetting.lastPayoutAt?.toISO() || null,
        last_payout_status: businessSetting.lastPayoutStatus || null,
      }
      response.status(200).json(formatSuccessMessage('Settings updated successfully', data))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  // POST /api/user/settings/switch-environment
  public async switchEnvironment({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const user = auth.use('user').user!
      const { environment } = request.only(['environment'])

      if (!environment || !['LIVE', 'TEST'].includes(String(environment).toUpperCase())) {
        return response.status(400).json(await formatErrorMessage(new Error('environment must be LIVE or TEST')))
      }

      const target = String(environment).toUpperCase() as 'LIVE' | 'TEST'

      if (target === 'LIVE' && !user.isVerified) {
        return response.status(403).json(await formatErrorMessage(
          new Error('Your account must be verified by an admin before switching to LIVE mode.')
        ))
      }

      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')

      businessSetting.currentEnvironment = target as any
      await businessSetting.save()

      return response.status(200).json(formatSuccessMessage(
        `Switched to ${target} mode successfully`,
        { current_environment: businessSetting.currentEnvironment }
      ))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}

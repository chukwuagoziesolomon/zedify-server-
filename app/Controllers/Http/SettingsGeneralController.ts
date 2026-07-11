import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { FeeBearer, CurrentEnvironment, PayoutInterval } from 'App/Lib/types'
import SettingsGeneralValidator from 'App/Validators/SettingsGeneralValidator'

export default class SettingsGeneralController extends RolesController {
  // GET /api/client/settings/general
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
      await businessSetting.save()
      const data = {
        fee_bearer: businessSetting.feeBearer,
        current_environment: businessSetting.currentEnvironment,
        payout_interval: businessSetting.payoutInterval,
        payout_type: businessSetting.payoutType,
      }
      response.status(200).json(formatSuccessMessage('Settings updated successfully', data))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}

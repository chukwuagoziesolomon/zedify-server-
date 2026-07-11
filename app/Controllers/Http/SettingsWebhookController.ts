import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { CurrentEnvironment } from 'App/Lib/types'

export default class SettingsWebhookController extends RolesController {
  // GET /api/client/settings/webhook
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')

      const data = {
        live: {
          url: businessSetting.liveWebhookUrl || null,
          environment: CurrentEnvironment.LIVE,
        },
        test: {
          url: businessSetting.testWebhookUrl || null,
          environment: CurrentEnvironment.TEST,
        },
      }
      response.status(200).json(formatSuccessMessage('Webhook URLs retrieved successfully', data))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  // POST /api/client/settings/webhook
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { url, environment } = request.only(['url', 'environment'])
      if (!url || !environment) throw new Error('webhook url and environment are required')

      const env = (environment as string).toUpperCase()
      if (![CurrentEnvironment.LIVE, CurrentEnvironment.TEST].includes(env as CurrentEnvironment)) {
        throw new Error('Invalid environment')
      }

      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')
      if (env === CurrentEnvironment.LIVE) {
        businessSetting.liveWebhookUrl = url
      } else {
        businessSetting.testWebhookUrl = url
      }
      await businessSetting.save()

      response.status(200).json(formatSuccessMessage('Webhook configured successfully', { url, environment: env }))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}

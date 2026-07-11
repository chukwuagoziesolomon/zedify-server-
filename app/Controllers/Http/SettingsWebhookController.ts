import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import WebhookLog from 'App/Models/WebhookLog'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { CurrentEnvironment } from 'App/Lib/types'
import WebhookDispatcherService from 'App/Services/WebhookDispatcherService'

export default class SettingsWebhookController extends RolesController {
  /**
   * GET /api/user/settings/webhook
   * Returns the saved webhook URLs and whether a signing secret exists.
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const setting = await BusinessSetting.query().where('business_id', userId).first()
      if (!setting) throw new Error('Business settings not found!')

      return response.ok(formatSuccessMessage('Webhook settings retrieved', {
        live: { url: setting.liveWebhookUrl || null },
        test: { url: setting.testWebhookUrl || null },
        has_signing_secret: !!setting.webhookSigningSecret,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/settings/webhook
   * Save a webhook URL for LIVE or TEST.
   * Body: { url, environment }
   */
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { url, environment } = request.only(['url', 'environment'])
      if (!url || !environment) throw new Error('url and environment are required.')

      const env = String(environment).toUpperCase()
      if (![CurrentEnvironment.LIVE, CurrentEnvironment.TEST].includes(env as CurrentEnvironment)) {
        throw new Error('environment must be LIVE or TEST.')
      }

      // Basic URL validation
      try { new URL(url) } catch { throw new Error('url must be a valid HTTPS URL.') }
      if (!url.startsWith('https://')) throw new Error('Webhook URL must use HTTPS.')

      const setting = await BusinessSetting.query().where('business_id', userId).firstOrFail()
      if (env === CurrentEnvironment.LIVE) {
        setting.liveWebhookUrl = url
      } else {
        setting.testWebhookUrl = url
      }
      await setting.save()

      return response.ok(formatSuccessMessage('Webhook URL saved', { url, environment: env }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/settings/webhook/secret/generate
   * Generate (or rotate) the merchant's webhook signing secret.
   * ⚠ Returns the plain secret ONCE — store it immediately.
   */
  public async generateSecret({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const setting = await BusinessSetting.query().where('business_id', userId).firstOrFail()

      const secret = WebhookDispatcherService.generateSigningSecret()
      setting.webhookSigningSecret = secret
      await setting.save()

      return response.ok(formatSuccessMessage(
        'Signing secret generated. Store this securely — it will not be shown again.',
        { signing_secret: secret }
      ))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/settings/webhook/verify
   * Send a test ping to the saved webhook URL and return the result.
   * Body: { environment } — LIVE or TEST
   */
  public async verifyUrl({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { environment } = request.only(['environment'])
      const env = String(environment || 'TEST').toUpperCase()

      const setting = await BusinessSetting.query().where('business_id', userId).firstOrFail()
      const webhookUrl = env === CurrentEnvironment.LIVE ? setting.liveWebhookUrl : setting.testWebhookUrl

      if (!webhookUrl) throw new Error(`No ${env} webhook URL configured. Save a URL first.`)

      const secret = setting.webhookSigningSecret || 'no-secret-configured'
      const result = await WebhookDispatcherService.verify_url(webhookUrl, secret)

      return response.ok(formatSuccessMessage('Webhook test complete', {
        url: webhookUrl,
        reachable: result.ok,
        status_code: result.statusCode ?? null,
        error: result.error ?? null,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/user/settings/webhook/logs
   * View recent webhook delivery attempts.
   * Query: page?, limit?, event?, success?
   */
  public async logs({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const page = Number(request.input('page', 1)) || 1
      const limit = Math.min(Number(request.input('limit', 20)) || 20, 100)
      const event = request.input('event')
      const success = request.input('success')

      const query = WebhookLog.query()
        .where('businessId', userId)
        .orderBy('createdAt', 'desc')

      if (event) query.where('event', String(event))
      if (success !== undefined && success !== null) {
        query.where('success', success === 'true')
      }

      const logs = await query.paginate(page, limit)

      return response.ok(formatSuccessMessage('Webhook logs retrieved', logs))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}


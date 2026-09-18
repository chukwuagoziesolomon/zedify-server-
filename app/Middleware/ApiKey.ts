import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Hash from '@ioc:Adonis/Core/Hash'
import BusinessSetting from 'App/Models/BusinessSetting'
import { DateTime } from 'luxon'

export default class ApiKeyMiddleware {
  public async handle({ request, response }: HttpContextContract, next: () => Promise<void>) {
    const authorization = request.header('authorization') || ''
    const secretKey = authorization.replace(/^Bearer\s+/i, '').trim()

    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) {
      return response.unauthorized({
        error: true,
        data: 'A valid secret API key is required',
        code: 401,
      })
    }

    const isLive = secretKey.startsWith('sk_live_')
    const settings = await BusinessSetting.query().whereNotNull(
      isLive ? 'live_private_key' : 'test_private_key'
    )

    for (const setting of settings) {
      if (!isLive && setting.testKeyExpiresAt && DateTime.now() > setting.testKeyExpiresAt) {
        continue
      }

      const storedKey = isLive ? setting.livePrivateKey : setting.testPrivateKey
      if (storedKey && await Hash.verify(storedKey, secretKey)) {
        const context = request.ctx as HttpContextContract & {
          apiBusinessId?: string
          apiEnvironment?: 'LIVE' | 'TEST'
        }
        context.apiBusinessId = setting.businessId
        context.apiEnvironment = isLive ? 'LIVE' : 'TEST'
        await next()
        return
      }
    }

    return response.unauthorized({
      error: true,
      data: 'Invalid or expired secret API key',
      code: 401,
    })
  }
}
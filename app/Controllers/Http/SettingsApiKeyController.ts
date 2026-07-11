import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import User from 'App/Models/User'
import Hash from '@ioc:Adonis/Core/Hash'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { CurrentEnvironment } from 'App/Lib/types'
import { DateTime } from 'luxon'
import crypto from 'crypto'

const TEST_KEY_TTL_HOURS = 2

function generateKey(prefix: string) {
  const random = crypto.randomBytes(20).toString('hex')
  return `${prefix}_${random}`
}

export default class SettingsApiKeyController extends RolesController {
  /**
   * GET /api/client/settings/api-key
   *
   * Returns the current public key for the active environment.
   * - TEST: only returned if not expired, otherwise null
   * - LIVE: only returned if user is verified
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')

      const user = await User.query().where('uniqueId', userId).firstOrFail()
      const env = (businessSetting.currentEnvironment || '').toUpperCase()

      let public_key: string | null = null
      let expires_at: string | null = null

      if (env === CurrentEnvironment.LIVE) {
        if (!user.isVerified) {
          return response.status(403).json({
            error: true,
            data: 'Your account must be verified to access LIVE API keys.',
            code: 403,
            requires_verification: true,
          })
        }
        public_key = businessSetting.livePublicKey || null
      } else {
        // Test key — check expiry
        const expiry = businessSetting.testKeyExpiresAt
        if (expiry && DateTime.now() > expiry) {
          // Expired — clear it
          businessSetting.testPublicKey = ''
          businessSetting.testPrivateKey = ''
          businessSetting.testKeyExpiresAt = null
          await businessSetting.save()
          public_key = null
        } else {
          public_key = businessSetting.testPublicKey || null
          expires_at = expiry?.toISO() ?? null
        }
      }

      return response.ok(
        formatSuccessMessage('API keys retrieved successfully', {
          private_key: null, // Only shown once at generation
          public_key,
          expires_at,
          environment: env,
        })
      )
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/client/settings/api-key
   *
   * Generate a new key pair for the current environment.
   * - TEST: anyone can generate; expires in 2 hours
   * - LIVE: only verified users can generate
   */
  public async generate({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      let businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')

      const user = await User.query().where('uniqueId', userId).firstOrFail()
      const env = (businessSetting.currentEnvironment || '').toUpperCase()

      let privateKey: string
      let publicKey: string
      let expiresAt: string | null = null

      if (env === CurrentEnvironment.LIVE) {
        if (!user.isVerified) {
          return response.status(403).json({
            error: true,
            data: 'Your account must be verified before you can generate LIVE API keys. Please complete your verification to proceed.',
            code: 403,
            requires_verification: true,
          })
        }
        privateKey = generateKey('sk_live')
        publicKey = generateKey('pk_live')
        businessSetting.livePrivateKey = await Hash.make(privateKey)
        businessSetting.livePublicKey = publicKey
      } else {
        privateKey = generateKey('sk_test')
        publicKey = generateKey('pk_test')
        const expiry = DateTime.now().plus({ hours: TEST_KEY_TTL_HOURS })
        businessSetting.testPrivateKey = await Hash.make(privateKey)
        businessSetting.testPublicKey = publicKey
        businessSetting.testKeyExpiresAt = expiry
        expiresAt = expiry.toISO()
      }

      await businessSetting.save()

      return response.ok(
        formatSuccessMessage('API keys generated successfully', {
          private_key: privateKey, // Show once only
          public_key: publicKey,
          expires_at: expiresAt,  // null for LIVE keys (no expiry)
          environment: env,
        })
      )
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/settings/api-key/verify
   * Verify a secret key (for developers testing their integration).
   * Respects test key expiry — expired test keys return 401.
   * Body: { secret_key }
   */
  public async verify({ request, response }: HttpContextContract) {
    try {
      const secretKey = request.input('secret_key')
      if (!secretKey) throw new Error('secret_key is required.')

      const isLive = String(secretKey).startsWith('sk_live_')
      const isTest = String(secretKey).startsWith('sk_test_')
      if (!isLive && !isTest) throw new Error('Invalid key format.')

      const settings = await BusinessSetting.query().whereNotNull(
        isLive ? 'live_private_key' : 'test_private_key'
      )

      for (const setting of settings) {
        const stored = isLive ? setting.livePrivateKey : setting.testPrivateKey
        if (!stored) continue

        // Check test key expiry before verifying hash (saves bcrypt time)
        if (isTest && setting.testKeyExpiresAt && DateTime.now() > setting.testKeyExpiresAt) {
          continue // expired — treat as non-existent
        }

        const valid = await Hash.verify(stored, secretKey)
        if (valid) {
          return response.ok(
            formatSuccessMessage('Key is valid', {
              environment: isLive ? CurrentEnvironment.LIVE : CurrentEnvironment.TEST,
              business_id: setting.businessId,
              ...(isTest && setting.testKeyExpiresAt
                ? { expires_at: setting.testKeyExpiresAt.toISO() }
                : {}),
            })
          )
        }
      }

      return response.status(401).json({ error: true, data: 'Invalid or expired key.', code: 401 })
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }
}

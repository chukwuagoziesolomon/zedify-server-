import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BusinessSetting from 'App/Models/BusinessSetting'
import Hash from '@ioc:Adonis/Core/Hash'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { CurrentEnvironment } from 'App/Lib/types'

import crypto from 'crypto'

function generateKey(prefix: string) {
  // Generates a key like sk_test_cc2c041802bbe2dcbfa9e92beb343c819ea09505
  const random = crypto.randomBytes(20).toString('hex')
  return `${prefix}_${random}`
}

export default class SettingsApiKeyController extends RolesController {
  // GET /api/client/settings/api-key
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) throw new Error('Business settings not found!')

      // Normalize environment for comparison
      const env = (businessSetting.currentEnvironment || '').toUpperCase()
      let public_key: string | null = null
      if (env === CurrentEnvironment.LIVE) {
        public_key = businessSetting.livePublicKey || null
      } else {
        public_key = businessSetting.testPublicKey || null
      }

      const result = {
        private_key: null as string | null, // Only shown on creation
        public_key,
      }

      response.status(200).json(
        formatSuccessMessage('API keys retrieved successfully', result)
      )
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  // POST /api/client/settings/api-key
  public async generate({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      let businessSetting = await BusinessSetting.query().where('business_id', userId).first()
      if (!businessSetting) {
        throw new Error('Business settings not found!')
      }

      // Normalize environment for comparison
      const env = (businessSetting.currentEnvironment || '').toUpperCase()
      let privateKey: string, publicKey: string, hashedPrivateKey: string
      if (env === CurrentEnvironment.LIVE) {
        privateKey = generateKey('sk_live')
        publicKey = generateKey('pk_live')
        hashedPrivateKey = await Hash.make(privateKey)
        businessSetting.livePrivateKey = hashedPrivateKey
        businessSetting.livePublicKey = publicKey
      } else {
        privateKey = generateKey('sk_test')
        publicKey = generateKey('pk_test')
        hashedPrivateKey = await Hash.make(privateKey)
        businessSetting.testPrivateKey = hashedPrivateKey
        businessSetting.testPublicKey = publicKey
      }
      await businessSetting.save()

      const result = {
        private_key: privateKey,
        public_key: publicKey,
      }

      response.status(200).json(
        formatSuccessMessage('API keys generated successfully', result)
      )
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}

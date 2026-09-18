import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import { formatErrorMessage } from 'App/helpers/utils'

export default class CkbController {
  public async config({ response }: HttpContextContract) {
    try {
      const networks = await CryptoNetwork.query()
        .where('networkType', 'ckb')
        .select(['uniqueId', 'name', 'logo', 'isTestnet', 'chainKey', 'chainId'])

      return response.ok({
        error: false,
        data: {
          ckb_network: Env.get('CKB_NETWORK', 'testnet'),
          ccc_network: Env.get('CCC_NETWORK', Env.get('CKB_NETWORK', 'testnet')),
          networks,
          switching: false,
          message: 'Network is selected by the backend deployment configuration',
        },
      })
    } catch (error) {
      return response.internalServerError(await formatErrorMessage(error))
    }
  }
}

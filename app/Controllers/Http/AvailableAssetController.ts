import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Currency from 'App/Models/Currency'
import { formatErrorMessage } from 'App/helpers/utils'

export default class AvailableAssetController {
  public async index({ response }: HttpContextContract) {
    try {
      const assets = await Currency.query()
        .where('is_blocked', false)
        .where('is_deleted', false)
        .preload('cryptoNetwork')
        .orderBy('name', 'asc')

      const payload = assets.map((asset) => ({
        currency_id: asset.uniqueId,
        crypto: {
          id: asset.uniqueId,
          name: asset.name,
          symbol: asset.symbol,
          logo: asset.logo || null,
          type: asset.type,
          contractAddress: asset.contractAddress || null,
          ratePerUsd: Number(asset.ratePerUsd || 0),
        },
        network: asset.cryptoNetwork
          ? {
              id: asset.cryptoNetwork.uniqueId,
              name: asset.cryptoNetwork.name,
              logo: asset.cryptoNetwork.logo || null,
              isTestnet: Boolean(asset.cryptoNetwork.isTestnet),
              networkType: asset.cryptoNetwork.networkType || null,
              chainKey: asset.cryptoNetwork.chainKey || null,
              chainId: asset.cryptoNetwork.chainId || null,
            }
          : null,
      }))

      return response.ok({
        error: false,
        message: 'Available assets fetched successfully',
        data: payload,
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

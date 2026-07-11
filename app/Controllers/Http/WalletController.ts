import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import User from 'App/Models/User'
import UserWallet from 'App/Models/UserWallet'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Currency from 'App/Models/Currency'

export default class WalletController extends RolesController {
  /**
   * GET /user/wallet/balance
   * Returns the authenticated user's wallet balance(s) for all networks/currencies.
   */
  public async balance({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()

      const wallets = await UserWallet.query()
        .where('userId', user.id)
        .where('status', 'active')
        .preload('user')
        .preload('cryptoNetwork')
        .preload('currency')

      const balances = wallets.map((wallet) => ({
        wallet_id: wallet.uniqueId,
        network: wallet.cryptoNetwork?.name || 'Unknown',
        network_unique_id: wallet.cryptoNetwork?.uniqueId,
        currency: wallet.currency?.code || 'USDT',
        currency_unique_id: wallet.currency?.uniqueId,
        wallet_address: wallet.walletAddress,
        balance: wallet.balance,
        total_deposited: wallet.totalDeposited,
        total_withdrawn: wallet.totalWithdrawn,
        status: wallet.status,
        created_at: wallet.createdAt,
      }))

      return response.ok(
        formatSuccessMessage('Wallet balance retrieved', {
          user_id: user.uniqueId,
          wallets: balances,
          total_balance: wallets.reduce((sum, w) => sum + w.balance, 0),
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /user/wallet/:network_id/balance
   * Returns the user's wallet balance for a specific blockchain network.
   * Params: network_id (CryptoNetwork.uniqueId)
   */
  public async balanceByNetwork({ auth, params, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()
      const { network_id } = params

      const network = await CryptoNetwork.findByOrFail('uniqueId', network_id)
      const wallet = await UserWallet.query()
        .where('userId', user.id)
        .where('cryptoNetworkId', network.uniqueId)
        .where('status', 'active')
        .preload('currency')
        .first()

      if (!wallet) {
        return response.notFound(
          formatErrorMessage(new Error(`No active wallet found for network: ${network.name}`))
        )
      }

      return response.ok(
        formatSuccessMessage('Network wallet balance retrieved', {
          wallet_id: wallet.uniqueId,
          network: network.name,
          currency: wallet.currency?.code || 'USDT',
          wallet_address: wallet.walletAddress,
          balance: wallet.balance,
          total_deposited: wallet.totalDeposited,
          total_withdrawn: wallet.totalWithdrawn,
          status: wallet.status,
          created_at: wallet.createdAt,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

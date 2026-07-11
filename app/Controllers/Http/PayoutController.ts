import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import PayoutDetail from 'App/Models/PayoutDetail'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import PayoutDetailValidator from 'App/Validators/PayoutDetailValidator'
import { PayoutType } from 'App/Lib/types'

export default class PayoutController extends RolesController {
  // GET /api/client/settings/payout
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const payout = await PayoutDetail.query().where('user_id', userId).andWhere('is_deleted', false).first()
      let data
      if (!payout) {
        data = {
          type: null,
          network_id: null,
          wallet_address: null,
          currency_id: null,
          bank_account_no: null,
          bank_name: null,
        }
      } else {
        data = {
          type: payout.type,
          network_id: payout.networkId,
          wallet_address: payout.walletAddress,
          currency_id: payout.currencyId,
          bank_account_no: payout.bankAccountNo,
          bank_name: payout.bankName,
        }
      }
      response.status(200).json(formatSuccessMessage('Settings retrieved successfully', data))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  // POST /api/client/settings/payout
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const payload = await request.validate(PayoutDetailValidator)
      // Soft-delete all existing payout details for this user
      await PayoutDetail.query().where('user_id', userId).andWhere('is_deleted', false).update({ isDeleted: true })
      // Create new payout detail
      const payout = new PayoutDetail()
      payout.userId = userId
      payout.type = payload.type as PayoutType
      payout.networkId = payload.network_id || null
      payout.walletAddress = payload.wallet_address || null
      payout.currencyId = payload.currency_id || null
      payout.bankAccountNo = payload.bank_account_no || null
      payout.bankName = payload.bank_name || null
      payout.isDeleted = false
      await payout.save()
      response.status(200).json(formatSuccessMessage('Payout details updated successfully', null))
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}

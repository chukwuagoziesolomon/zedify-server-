import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import WithdrawalService from 'App/Services/WithdrawalService'
import UserWallet from 'App/Models/UserWallet'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Transfer from 'App/Models/Transfer'
import User from 'App/Models/User'
import PayoutDetail from 'App/Models/PayoutDetail'

export default class WithdrawalController extends RolesController {

  /**
   * GET /api/user/withdrawal/quote
   * Returns fee breakdown before the user commits.
   *
   * Query params:
   *   amount  - number (required)
   *   type    - 'crypto' | 'fiat' (required)
   */
  public async quote({ request, response, auth }: HttpContextContract) {
    try {
      this.allowOnlyLoggedInUsers(auth)
      const amount = parseFloat(request.input('amount'))
      const type = request.input('type', 'crypto') as 'crypto' | 'fiat'

      if (!amount || amount <= 0) throw new Error('amount must be a positive number.')
      if (!['crypto', 'fiat'].includes(type)) throw new Error('type must be crypto or fiat.')

      let fees
      if (type === 'fiat') {
        fees = await WithdrawalService.calculateFiatFees(amount)
      } else {
        fees = WithdrawalService.calculateFees(amount, 'crypto')
      }

      return response.ok(formatSuccessMessage('Fee quote calculated', fees))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/withdrawal/initiate
   * Validates the payload, checks balance, sends OTP email.
   *
   * Body (crypto):
   * {
   *   type: 'crypto',
   *   user_wallet_id: string,
   *   crypto_currency_id: string,
   *   network_id: string,
   *   amount: number,
   *   recipient_address: string
   * }
   *
   * Body (fiat):
   * {
   *   type: 'fiat',
   *   user_wallet_id: string,
   *   amount: number,
   *   bank_name: string,
   *   account_number: string,
   *   bank_code: string,
   *   account_name: string
   * }
   */
  public async initiate({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const body = request.all()
      const type = String(body.type || '').toLowerCase()

      if (!['crypto', 'fiat'].includes(type)) {
        throw new Error('type must be crypto or fiat.')
      }

      const amount = parseFloat(body.amount)
      if (!amount || amount <= 0) throw new Error('amount must be a positive number.')

      // Validate user wallet
      const userWallet = await UserWallet.query()
        .where('uniqueId', body.user_wallet_id)
        .where('userId', auth.use('user').user!.id)
        .where('status', 'active')
        .first()
      if (!userWallet) throw new Error('Wallet not found or inactive.')
      if (Number(userWallet.balance) < amount) {
        throw new Error(`Insufficient balance. Available: ${userWallet.balance}`)
      }

      let payload: any

      if (type === 'crypto') {
        if (!body.recipient_address) throw new Error('recipient_address is required.')
        if (!body.network_id) throw new Error('network_id is required.')
        if (!body.crypto_currency_id) throw new Error('crypto_currency_id is required.')

        // Validate network and currency exist
        const network = await CryptoNetwork.query().where('uniqueId', body.network_id).first()
        if (!network) throw new Error('Network not found.')
        const currency = await Currency.query().where('uniqueId', body.crypto_currency_id).first()
        if (!currency) throw new Error('Crypto currency not found.')

        payload = {
          type: 'crypto',
          userWalletId: body.user_wallet_id,
          cryptoCurrencyId: body.crypto_currency_id,
          networkId: body.network_id,
          amount,
          recipientAddress: body.recipient_address,
        }
      } else {
        // Load bank details from saved payout settings — never from request body
        const payoutDetail = await PayoutDetail.query()
          .where('userId', userId)
          .where('isDeleted', false)
          .where('type', 'FIAT')
          .first()

        if (!payoutDetail) {
          throw new Error('No bank account found. Please add your bank account in Settings > Payout before withdrawing.')
        }
        if (!payoutDetail.bankAccountNo) throw new Error('Bank account number is missing in your payout settings.')
        if (!payoutDetail.bankName) throw new Error('Bank name is missing in your payout settings.')
        if (!payoutDetail.bankCode) throw new Error('Bank code is missing in your payout settings.')
        if (!payoutDetail.accountName) throw new Error('Account name is missing in your payout settings.')

        payload = {
          type: 'fiat',
          userWalletId: body.user_wallet_id,
          amount,
          bankName: payoutDetail.bankName,
          accountNumber: payoutDetail.bankAccountNo,
          bankCode: payoutDetail.bankCode,
          accountName: payoutDetail.accountName,
        }
      }

      const { otpId } = await WithdrawalService.sendWithdrawalOtp(userId, payload)

      let fees
      if (type === 'fiat') {
        fees = await WithdrawalService.calculateFiatFees(amount)
      } else {
        fees = WithdrawalService.calculateFees(amount, 'crypto')
      }

      return response.ok(
        formatSuccessMessage('OTP sent to your registered email. Please confirm to proceed.', {
          otp_id: otpId,
          fees,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/withdrawal/confirm
   * Verifies the OTP and processes the withdrawal.
   *
   * Body:
   * {
   *   otp_id: string,
   *   otp_code: string
   * }
   */
  public async confirm({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { otp_id, otp_code } = request.only(['otp_id', 'otp_code'])

      if (!otp_id) throw new Error('otp_id is required.')
      if (!otp_code) throw new Error('otp_code is required.')

      const result = await WithdrawalService.confirmWithdrawal(userId, otp_id, String(otp_code))

      return response.ok(formatSuccessMessage(result.message, {
        status: result.status,
        tx_hash: result.txHash ?? null,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /user/withdrawals/history
   * Returns paginated withdrawal (transfer) history for the authenticated user.
   * Query: page, limit, status
   */
  public async history({ request, response, auth }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20
      const status = request.input('status')

      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()

      const query = Transfer.query().where('senderUserId', user.id)

      if (status) {
        query.where('status', String(status))
      }

      const transfers = await query.orderBy('createdAt', 'desc').paginate(page, limit)

      return response.ok(formatSuccessMessage('Withdrawal history fetched', transfers))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import WithdrawalService from 'App/Services/WithdrawalService'
import UserWallet from 'App/Models/UserWallet'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'

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
        if (!body.bank_name) throw new Error('bank_name is required.')
        if (!body.account_number) throw new Error('account_number is required.')
        if (!body.bank_code) throw new Error('bank_code is required.')
        if (!body.account_name) throw new Error('account_name is required.')

        payload = {
          type: 'fiat',
          userWalletId: body.user_wallet_id,
          amount,
          bankName: body.bank_name,
          accountNumber: body.account_number,
          bankCode: body.bank_code,
          accountName: body.account_name,
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
}

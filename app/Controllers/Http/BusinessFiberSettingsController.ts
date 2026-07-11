import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import BusinessFiberSetupService from 'App/Services/BusinessFiberSetupService'
import FiberPaymentSettlementService from 'App/Services/FiberPaymentSettlementService'
import SudtService from 'App/Services/SudtService'
import User from 'App/Models/User'

export default class BusinessFiberSettingsController extends RolesController {
  /**
   * POST /api/business/fiber/setup
   * Enable Fiber payments for a business
   */
  public async setup({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const user = auth.use('user').user

      if (!user?.businessName) {
        return response.badRequest(
          await formatErrorMessage(new Error('Only businesses can enable Fiber payments'))
        )
      }

      const { accept_ckb, accept_sudt, min_channel_balance } = request.all()

      const result = await BusinessFiberSetupService.setupFiberForBusiness(userId, {
        accept_ckb: accept_ckb !== false,
        accept_sudt: accept_sudt !== false,
        min_channel_balance: min_channel_balance || 0.5,
      })

      return response.ok(
        formatSuccessMessage('Fiber payments enabled successfully', result)
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/business/fiber/setup
   * Get Fiber settings for business
   */
  public async getSetup({ response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const setting = await BusinessFiberSetupService.getFiberSettings(userId)
      if (!setting) {
        return response.notFound(
          await formatErrorMessage(new Error('Fiber not enabled for this business'))
        )
      }

      const channelInfo = await BusinessFiberSetupService.getChannelInfo(userId)
      const methods = await BusinessFiberSetupService.getAvailablePaymentMethods(userId)

      const responseData = {
        enabled: true,
        channel_id: setting.fiberChannelId,
        peer_id: setting.fiberPeerId,
        accept_ckb: setting.acceptCkb,
        accept_sudt: setting.acceptSudt,
        min_channel_balance: setting.minChannelBalance,
        auto_convert_daily: setting.autoConvertDaily,
        auto_convert_threshold: setting.autoConvertThreshold,
        settlement_schedule: setting.settlementSchedule,
        channel_info: channelInfo,
        payment_methods: methods,
        total_received_ckb: setting.totalReceivedCkb,
        total_converted_usd: setting.totalConvertedUsd,
        created_at: setting.createdAt.toISO(),
      }

      return response.ok(formatSuccessMessage('Fiber settings retrieved', responseData))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PATCH /api/business/fiber/settlement
   * Update settlement preferences
   */
  public async updateSettlement({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const preferences = request.all()

      const updated = await BusinessFiberSetupService.updateSettlementPreferences(
        userId,
        preferences
      )

      return response.ok(
        formatSuccessMessage('Settlement preferences updated', {
          auto_convert_daily: updated.autoConvertDaily,
          auto_convert_threshold: updated.autoConvertThreshold,
          min_channel_balance: updated.minChannelBalance,
          settlement_schedule: updated.settlementSchedule,
          updated_at: updated.updatedAt.toISO(),
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/business/fiber/accept-sudt
   * Enable SUDT token for business
   */
  public async acceptSudt({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { type_script } = request.all()

      if (!type_script) {
        throw new Error('type_script is required')
      }

      const accepted = await BusinessFiberSetupService.enableSudtForBusiness(
        userId,
        type_script
      )

      return response.ok(
        formatSuccessMessage('SUDT token enabled for business', {
          symbol: accepted.symbol,
          type_script: accepted.sudtTypeScript,
          enabled: accepted.enabled,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /api/business/fiber/accept-sudt/:typeScript
   * Disable SUDT token for business
   */
  public async rejectSudt({ response, auth, params }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      await BusinessFiberSetupService.disableSudtForBusiness(userId, params.typeScript)

      return response.ok(formatSuccessMessage('SUDT token disabled for business', {}))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/business/fiber/accepted-sudt
   * Get accepted SUDT tokens for business
   */
  public async getAcceptedSudt({ response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const tokens = await BusinessFiberSetupService.getAcceptedSudtTokens(userId)

      const responseData = tokens.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        type_script: token.sudtTypeScript,
        logo: token.logo,
        enabled: token.enabled,
        auto_convert: token.autoConvertEnabled,
      }))

      return response.ok(formatSuccessMessage('Accepted SUDT tokens', responseData))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/business/fiber/available-sudt
   * Get available SUDT tokens to accept
   */
  public async getAvailableSudt({ response }: HttpContextContract) {
    try {
      const tokens = await SudtService.getPopularSudtTokens('ckb-testnet')

      const responseData = tokens.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        type_script: token.typeScript,
        logo: token.logo,
        network: token.network,
      }))

      return response.ok(formatSuccessMessage('Available SUDT tokens', responseData))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/business/fiber/payments
   * Get payment history
   */
  public async getPayments({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20

      const history = await FiberPaymentSettlementService.getSettlementHistory(userId, limit)

      return response.ok(
        formatSuccessMessage('Payment history', {
          page,
          limit,
          total: history.length,
          payments: history,
        })
      )
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/business/fiber/stats
   * Get settlement statistics
   */
  public async getStats({ response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      const stats = await FiberPaymentSettlementService.getSettlementStats(userId)

      if (!stats) {
        return response.notFound(
          await formatErrorMessage(new Error('Business not found'))
        )
      }

      return response.ok(formatSuccessMessage('Settlement statistics', stats))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/business/fiber/disable
   * Disable Fiber for business
   */
  public async disableFiber({ response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)

      await BusinessFiberSetupService.disableFiberForBusiness(userId)

      return response.ok(formatSuccessMessage('Fiber payments disabled', {}))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

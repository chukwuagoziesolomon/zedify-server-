import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import SystemSetting from 'App/Models/SystemSetting'
import { clearPlatformFeeCache, formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'

export default class SystemSettingsController {
  // GET /api/admin/system-settings
  public async show({ response }: HttpContextContract) {
    try {
      const setting = await SystemSetting.query().first()
      if (!setting) {
        const created = await SystemSetting.create({
          durationPerTransaction: 30,
          platformFeePercentage: 5,
        })
        return response.ok(formatSuccessMessage('System settings retrieved', {
          duration_per_transaction: created.durationPerTransaction,
          platform_fee_percentage: created.platformFeePercentage,
        }))
      }

      return response.ok(formatSuccessMessage('System settings retrieved', {
        duration_per_transaction: setting.durationPerTransaction,
        platform_fee_percentage: setting.platformFeePercentage,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // PATCH /api/admin/system-settings
  public async update({ request, response }: HttpContextContract) {
    try {
      const body = request.only(['duration_per_transaction', 'platform_fee_percentage'])

      const setting = await SystemSetting.query().first()
      if (!setting) {
        const created = await SystemSetting.create({
          durationPerTransaction: body.duration_per_transaction ?? 30,
          platformFeePercentage: body.platform_fee_percentage ?? 5,
        })
        return response.ok(formatSuccessMessage('System settings created', {
          duration_per_transaction: created.durationPerTransaction,
          platform_fee_percentage: created.platformFeePercentage,
        }))
      }

      if (body.duration_per_transaction !== undefined) {
        setting.durationPerTransaction = Number(body.duration_per_transaction)
      }
      if (body.platform_fee_percentage !== undefined) {
        const platformFeePercentage = Number(body.platform_fee_percentage)
        if (!Number.isFinite(platformFeePercentage) || platformFeePercentage < 0 || platformFeePercentage > 100) {
          throw new Error('platform_fee_percentage must be a number between 0 and 100')
        }
        setting.platformFeePercentage = platformFeePercentage
      }

      await setting.save()
      clearPlatformFeeCache()

      return response.ok(formatSuccessMessage('System settings updated', {
        duration_per_transaction: setting.durationPerTransaction,
        platform_fee_percentage: setting.platformFeePercentage,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

import { BaseCommand } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'
import BusinessFiberSetting from 'App/Models/BusinessFiberSetting'
import FiberPaymentSettlementService from 'App/Services/FiberPaymentSettlementService'

/**
 * Scheduled command to handle auto-conversions and settlements
 * Run periodically: node ace settle:fiber-payments
 */
export default class SettleFiberPayments extends BaseCommand {
  public static commandName = 'settle:fiber-payments'
  public static description = 'Process Fiber payment settlements and auto-conversions'

  public async run() {
    this.logger.info('Starting Fiber payment settlement...')

    try {
      // Get all businesses with Fiber enabled and auto-convert enabled
      const businesses = await BusinessFiberSetting.query()
        .where('status', 'active')
        .where('autoConvertDaily', true)

      Logger.info(`[SettleFiberPayments] Found ${businesses.length} businesses with auto-convert enabled`)

      let settled = 0
      let failed = 0

      for (const business of businesses) {
        try {
          const result = await FiberPaymentSettlementService.handleAutoConversion(
            business.businessId
          )

          if (result && result.success) {
            settled++
            Logger.info(
              `[SettleFiberPayments] Auto-converted for business ${business.businessId}: ${result.amountCkb} CKB → ${result.amountUsdt} USDT`
            )
          }
        } catch (error) {
          failed++
          Logger.error(
            `[SettleFiberPayments] Failed for business ${business.businessId}: ${error.message}`
          )
        }
      }

      this.logger.info(
        `Fiber settlement complete: ${settled} succeeded, ${failed} failed`
      )
    } catch (error) {
      this.logger.error(`Settlement failed: ${error.message}`)
      process.exit(1)
    }
  }
}

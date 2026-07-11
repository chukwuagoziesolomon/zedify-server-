import { BaseCommand } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'
import PaymentIndexerService from 'App/Services/PaymentIndexerService'

/**
 * Poll Payments Command
 * Runs periodically to detect missed webhook payment confirmations
 * Usage: node ace poll:payments --interval=5
 */
export default class PollPaymentsCommand extends BaseCommand {
  public static commandName = 'poll:payments'

  public static description = 'Poll blockchain for pending crypto payments'

  public static settings = {
    /**
     * Set the correct project root for displaying relative paths
     */
    loadApp: true,
    stayAlive: false,
  }

  public async handle(): Promise<void> {
    try {
      this.logger.info('🔍 Starting payment polling')
      this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      await PaymentIndexerService.pollPendingPayments()

      this.logger.success('✓ Polling completed successfully')
      this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
      this.logger.error(`✗ Polling failed: ${error}`)
      Logger.error(`[PollPayments] Error: ${error}`)
      throw error
    }
  }
}

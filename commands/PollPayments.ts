import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'
import PaymentIndexerService from 'App/Services/PaymentIndexerService'

/**
 * PollPayments command
 *
 * Runs the payment indexer polling loop to catch any payment confirmations
 * that were missed by webhooks.
 *
 * Usage (single run):
 *   node ace poll:payments
 *
 * Usage (continuous loop — for use as a long-running worker process):
 *   node ace poll:payments --watch --interval=30
 */
export default class PollPaymentsCommand extends BaseCommand {
  public static commandName = 'poll:payments'

  public static description =
    'Poll blockchain for pending crypto payments. Use --watch for continuous polling.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({ alias: 'w', description: 'Keep running and poll on a fixed interval' })
  public declare watch: boolean

  @flags.number({
    alias: 'i',
    description: 'Polling interval in seconds when --watch is set (default: 30)',
  })
  public declare interval: number

  public async handle(): Promise<void> {
    const intervalSecs = this.interval ?? 30

    this.logger.info('🔍 Starting payment polling')
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Run once immediately
    await this.runOnce()

    if (!this.watch) {
      return
    }

    // Continuous watch mode
    this.logger.info(`👀 Watch mode — polling every ${intervalSecs}s. Press Ctrl+C to stop.`)
    PollPaymentsCommand.settings.stayAlive = true

    const loop = setInterval(async () => {
      await this.runOnce()
    }, intervalSecs * 1000)

    // Graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(loop)
      this.logger.info('\n⏹  Polling stopped')
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      clearInterval(loop)
      process.exit(0)
    })
  }

  private async runOnce(): Promise<void> {
    try {
      this.logger.info(`[${new Date().toISOString()}] Running poll cycle…`)
      await PaymentIndexerService.pollPendingPayments()
      this.logger.success('✓ Poll cycle completed')
    } catch (error) {
      this.logger.error(`✗ Poll cycle failed: ${error}`)
      Logger.error(`[PollPayments] Error: ${error}`)
    }
  }
}


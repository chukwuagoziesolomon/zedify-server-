import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import PaymentIntent from 'App/Models/PaymentIntent'
import FiberInvoice from 'App/Models/FiberInvoice'
import BalanceLedger, { LedgerTransactionType } from 'App/Models/BalanceLedger'
import { PaymentIntentStatus } from 'App/Lib/types'
import FiberPaymentSettlementService from 'App/Services/FiberPaymentSettlementService'
import PaymentIndexerService from 'App/Services/PaymentIndexerService'
import User from 'App/Models/User'
import BusinessWalletService from 'App/Services/BusinessWalletService'
import Logger from '@ioc:Adonis/Core/Logger'

const DB_RETRYABLE_ERRORS = [
  'Connection ended unexpectedly',
  'server conn crashed',
  'ECONNRESET',
  'ETIMEDOUT',
  'Connection timed out',
  'terminating connection due to administrator command',
  'could not receive data from server',
]

function isDbRetryable(error: any): boolean {
  const message = String(error?.message ?? error ?? '')
  return DB_RETRYABLE_ERRORS.some((pattern) => message.includes(pattern))
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const maxRetries = 3
  let lastError: any
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isDbRetryable(error) || attempt === maxRetries) {
        throw error
      }
      const waitMs = 800 * attempt
      Logger.warn(`[Reconcile] Retrying ${label} after transient DB error (${error.message}). attempt=${attempt} next_in=${waitMs}ms`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  throw lastError
}

export default class ReconcileCompletedPaymentsCommand extends BaseCommand {
  public static commandName = 'payments:reconcile-completed'
  public static description = 'Find completed payments without wallet conversion and optionally settle them'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Actually apply wallet credits; without this flag the command only reports candidates' })
  public declare apply: boolean

  @flags.boolean({ description: 'Include historical paid Fiber invoices, which may require manual review for duplicate settlement risk' })
  public declare includeFiber: boolean

  @flags.number({ description: 'Maximum number of completed payments to inspect' })
  public declare limit: number

  public async run(): Promise<void> {
    const intents = await withDbRetry('load intents', async () => {
      return await PaymentIntent.query()
        .where('status', PaymentIntentStatus.PAYMENT_COMPLETED)
        .orderBy('completedAt', 'asc')
        .limit(this.limit || 1000)
    })

    let candidates = 0
    let settled = 0
    let skipped = 0
    let failed = 0

    for (const intent of intents) {
      let ledger: BalanceLedger | null = null
      let fiberInvoice: FiberInvoice | null = null

      try {
        ledger = await withDbRetry('ledger check', () =>
          BalanceLedger.query()
            .where('reference', intent.uniqueId)
            .where('type', LedgerTransactionType.DEPOSIT)
            .first()
        )
      } catch (error) {
        Logger.error(`[Reconcile] Ledger check failed for ${intent.uniqueId}: ${error.message}`)
        failed++
        continue
      }
      if (ledger) continue

      try {
        fiberInvoice = await withDbRetry('fiber invoice check', () =>
          FiberInvoice.query()
            .where('paymentIntentId', intent.uniqueId)
            .first()
        )
      } catch (error) {
        Logger.error(`[Reconcile] Fiber check failed for ${intent.uniqueId}: ${error.message}`)
        failed++
        continue
      }

      if (fiberInvoice && !this.includeFiber) {
        this.logger.info(`[REVIEW] Fiber payment ${intent.uniqueId} has no settlement ledger. Re-run with --include-fiber.`)
        candidates++
        continue
      }

      candidates++
      if (!this.apply) {
        this.logger.info(`[DRY RUN] ${intent.uniqueId} is eligible for conversion`)
        continue
      }

      try {
        if (fiberInvoice && fiberInvoice.status !== 'paid') {
          this.logger.info(`[SKIP] Fiber invoice ${fiberInvoice.uniqueId} is ${fiberInvoice.status}`)
          skipped++
          continue
        }
        if (fiberInvoice && intent.cryptoCurrencyId) {
          const business = await withDbRetry('load business', () =>
            User.query().where('uniqueId', intent.businessId).firstOrFail()
          )
          await withDbRetry('provision ckb wallet', () =>
            BusinessWalletService.provisionCkbWallet(business.id, intent.cryptoCurrencyId as string)
          )
        }
        if (fiberInvoice) {
          await withDbRetry('settle fiber', () =>
            FiberPaymentSettlementService.settleFiberPayment(fiberInvoice!.uniqueId)
          )
        } else {
          const wallet = await withDbRetry('reconcile', () =>
            PaymentIndexerService.reconcileCompletedPayment(intent)
          )
          if (!wallet) {
            this.logger.warning(`[SKIP] Could not convert payment ${intent.uniqueId}`)
            skipped++
            continue
          }
        }

        settled++
        this.logger.success(`[SETTLED] ${intent.uniqueId}`)
      } catch (error) {
        Logger.error(`[Reconcile] Failed to settle ${intent.uniqueId}: ${error.message}`)
        failed++
      }
    }

    this.logger.info(`Completed reconciliation: ${candidates} candidate(s), ${settled} settled, ${skipped} skipped, ${failed} failed.`)
    if (!this.apply) {
      this.logger.info('Dry run only. Add --apply to write wallet credits.')
    }
    if (failed > 0) {
      this.logger.warning(`${failed} payment(s) failed. Re-run the command to retry failures.`)
    }
  }
}
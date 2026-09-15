import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import UserWallet from 'App/Models/UserWallet'
import BalanceLedger, { LedgerTransactionType } from 'App/Models/BalanceLedger'
import Logger from '@ioc:Adonis/Core/Logger'

export default class RepairWalletBalancesCommand extends BaseCommand {
  public static commandName = 'repair:wallet-balances'
  public static description = 'Recalculate UserWallet balances from BalanceLedger entries'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Dry run only; do not write changes' })
  public declare dryRun: boolean

  @flags.number({ description: 'Limit wallets to repair' })
  public declare limit: number

  public async run(): Promise<void> {
    const wallets = await UserWallet.query()
      .where('status', 'active')
      .orderBy('id', 'asc')
      .limit(this.limit || 1000)

    let checked = 0
    let repaired = 0
    let skipped = 0

    for (const wallet of wallets) {
      const ledgers = await BalanceLedger.query()
        .where('userWalletId', wallet.id)
        .orderBy('id', 'asc')

      const deposits = ledgers
        .filter((l) => l.type === LedgerTransactionType.DEPOSIT)
        .reduce((s, l) => s + Number(l.amount), 0)

      const transfers = ledgers
        .filter((l) => l.type === LedgerTransactionType.TRANSFER || l.type === LedgerTransactionType.FEE)
        .reduce((s, l) => s + Number(l.amount), 0)

      const expected = parseFloat((deposits - transfers).toFixed(6))
      const current = Number(wallet.balance)

      checked++

      if (expected === current) {
        skipped++
        continue
      }

      if (this.dryRun) {
        Logger.info(`[Repair] wallet=${wallet.uniqueId} current=${current} expected=${expected}`)
      } else {
        wallet.balance = expected
        wallet.totalDeposited = deposits
        wallet.totalWithdrawn = transfers
        await wallet.save()
        Logger.info(`[Repair] wallet=${wallet.uniqueId} updated ${current} -> ${expected}`)
      }

      repaired++
    }

    Logger.info(`Repair complete: checked=${checked} repaired=${repaired} skipped=${skipped}`)
    if (this.dryRun) {
      Logger.info('Dry run only. Re-run without --dry-run to apply changes.')
    }
  }
}

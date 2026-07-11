import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import UserWallet from 'App/Models/UserWallet'
import Transfer from 'App/Models/Transfer'
import User from 'App/Models/User'

export enum LedgerTransactionType {
  DEPOSIT = 'deposit', // USDT received
  TRANSFER = 'transfer', // USDT sent
  FEE = 'fee', // Platform fee deducted
  REFUND = 'refund', // Cancelled transfer refunded
  ADJUSTMENT = 'adjustment', // Admin adjustment
}

/**
 * BalanceLedger Model
 * Audit trail for all balance changes
 * Every debit/credit creates a ledger entry for transparency
 */
export default class BalanceLedger extends BaseModel {
  public static table = 'balance_ledgers'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public userId: number // FK → User.id (who owns the wallet)

  @column()
  public userWalletId: number // FK → UserWallet.id (which wallet changed)

  @column()
  public type: LedgerTransactionType // Type of transaction

  @column()
  public amount: number // Amount in USDT (always positive)

  @column()
  public balanceAfter: number // Balance after this transaction

  @column()
  public reference: string // Reference to related transaction (Transfer ID, Deposit ID, etc)

  @column()
  public description: string // Human-readable description

  @column()
  public transferId?: number // FK → Transfer.id (if related to transfer)

  @column()
  public status: 'pending' | 'completed' | 'failed' = 'completed'

  @column()
  public metadata?: string // JSON string for additional data

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @belongsTo(() => UserWallet)
  public wallet: BelongsTo<typeof UserWallet>

  @belongsTo(() => Transfer, {
    foreignKey: 'transferId',
  })
  public transfer: BelongsTo<typeof Transfer>
}

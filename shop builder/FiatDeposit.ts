import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import { BaseModel, column, beforeCreate, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import User from './User'
import Currency from './Currency'

export type FiatDepositStatus = 'pending' | 'fiat_received' | 'converting' | 'credited' | 'failed'

export default class FiatDeposit extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public userId: number

  @column()
  public targetCurrencyId: number

  @column()
  public nairaAmount: number

  @column()
  public exchangeRate: number | null

  @column()
  public convertedAmount: number | null

  @column()
  public provider: 'paystack' | 'flutterwave'

  @column()
  public providerReference: string

  @column()
  public status: FiatDepositStatus

  @column()
  public failureReason: string | null

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @belongsTo(() => Currency)
  public targetCurrency: BelongsTo<typeof Currency>

  @column.dateTime()
  public fiatReceivedAt: DateTime | null

  @column.dateTime()
  public creditedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeCreate()
  public static assignUuid(deposit: FiatDeposit) {
    deposit.uniqueId = uuidv4()
  }
}

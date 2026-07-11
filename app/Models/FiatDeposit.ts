import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import User from './User'
import Currency from './Currency'

export type FiatDepositStatus = 'pending' | 'fiat_received' | 'converting' | 'credited' | 'failed'

/**
 * Tracks every naira deposit attempt — created when the Paystack charge is
 * initialised and updated as the deposit moves through the pipeline.
 */
export default class FiatDeposit extends BaseModel {
  public static table = 'fiat_deposits'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  /** FK → User.id (integer PK, not uniqueId) */
  @column()
  public userId: number

  /** FK → Currency.id */
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

  /**
   * Optional: if this deposit is paying for an AI-customisation upgrade,
   * the shop's uniqueId is stored here so the webhook can unlock the shop.
   */
  @column()
  public shopCustomizationId: string | null

  @belongsTo(() => User, { foreignKey: 'userId', localKey: 'id' })
  public user: BelongsTo<typeof User>

  @belongsTo(() => Currency, { foreignKey: 'targetCurrencyId', localKey: 'id' })
  public targetCurrency: BelongsTo<typeof Currency>

  @column.dateTime()
  public fiatReceivedAt: DateTime | null

  @column.dateTime()
  public creditedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

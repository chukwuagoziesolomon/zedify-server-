import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import { PaymentLinkStatus } from 'App/Lib/types'
import User from './User'
import Currency from './Currency'

export default class PaymentLink extends BaseModel {
  public static table = 'payment_links'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string

  @column()
  public slug: string

  @column()
  public title: string

  @column()
  public description: string | null

  @column()
  public fiatCurrencyId: string | null

  @column()
  public fiatAmount: number | null

  @column()
  public status: PaymentLinkStatus

  @column()
  public isSingleUse: boolean

  @column()
  public usageCount: number

  @column()
  public usageLimit: number | null

  @column.dateTime()
  public expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'businessId', localKey: 'uniqueId' })
  public business: BelongsTo<typeof User>

  @belongsTo(() => Currency, { foreignKey: 'fiatCurrencyId', localKey: 'uniqueId' })
  public fiatCurrency: BelongsTo<typeof Currency>

  /** Whether this link is currently usable by a customer */
  public isActive(): boolean {
    if (this.status !== PaymentLinkStatus.ACTIVE) return false
    if (this.expiresAt && this.expiresAt < DateTime.now()) return false
    if (this.usageLimit !== null && this.usageCount >= this.usageLimit) return false
    return true
  }
}

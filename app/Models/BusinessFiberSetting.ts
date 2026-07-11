import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import User from './User'

export default class BusinessFiberSetting extends BaseModel {
  public static table = 'business_fiber_settings'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string // FK → User.uniqueId

  @column()
  public fiberChannelId: string // Fiber channel for receiving payments

  @column()
  public fiberPeerId: string // Fiber node peer ID

  @column()
  public fiberNodeUrl: string = 'http://127.0.0.1:8227' // Fiber RPC node URL

  @column()
  public acceptCkb: boolean = true

  @column()
  public acceptSudt: boolean = true

  @column()
  public minChannelBalance: number = 0.5 // Min CKB to keep in channel

  @column()
  public autoConvertDaily: boolean = false

  @column()
  public autoConvertThreshold: number = 10 // Auto-convert if > 10 CKB

  @column()
  public convertToAsset: string = 'usdt' // Convert CKB to USDT

  @column()
  public settlementSchedule: string = 'manual' // daily, weekly, manual

  @column()
  public lastConvertedAt?: DateTime

  @column()
  public totalReceivedCkb: number = 0

  @column()
  public totalConvertedUsd: number = 0

  @column()
  public status: string = 'active' // active, inactive, pending

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'businessId', localKey: 'uniqueId' })
  public business: BelongsTo<typeof User>
}

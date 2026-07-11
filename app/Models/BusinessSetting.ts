import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import { FeeBearer, CurrentEnvironment, PayoutInterval } from 'App/Lib/types'

export default class BusinessSetting extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: number

  @column()
  public testPrivateKey: string

  @column()
  public testPublicKey: string

  @column()
  public livePrivateKey: string

  @column()
  public livePublicKey: string

  @column()
  public testWebhookUrl: string

  @column()
  public liveWebhookUrl: string

  @column()
  public feeBearer: FeeBearer

  @column()
  public currentEnvironment: CurrentEnvironment

  @column()
  public payoutInterval: PayoutInterval

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

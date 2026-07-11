import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

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
  public feeBearer: 'business' | 'customers'

  @column()
  public currentEnvironment: 'live' | 'test'

  @column()
  public payoutInterval: 'instant' | 'daily' | 'weekly'

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

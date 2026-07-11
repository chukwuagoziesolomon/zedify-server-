import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class WebhookLog extends BaseModel {
  public static table = 'webhook_logs'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string

  @column()
  public event: string

  @column()
  public webhookUrl: string

  @column()
  public environment: string

  @column()
  public payload: any

  @column()
  public statusCode: number | null

  @column()
  public responseBody: string | null

  @column()
  public attempt: number

  @column()
  public success: boolean

  @column()
  public errorMessage: string | null

  @column.dateTime()
  public deliveredAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}

import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class SystemSetting extends BaseModel {
  public static table = 'system_settings_tb'

  @column({ isPrimary: true })
  public id: number

  @column()
  public durationPerTransaction: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

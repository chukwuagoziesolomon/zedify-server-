import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { BusinessCurrencyStatus } from 'App/Lib/types'
import { DateTime } from 'luxon'

export default class BusinessCurrency extends BaseModel {
  public static table = 'business_currency_tb'

  @column({ isPrimary: true })
  public id: number

  @column()
  public currencyId: string

  @column()
  public userId: string

  @column()
  public status: BusinessCurrencyStatus

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

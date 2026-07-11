import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { PayoutType } from 'App/Lib/types'
import { genRandomUuid } from 'App/helpers/utils'

export default class PayoutDetail extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public userId: number

  @column()
  public type: PayoutType

  @column()
  public networkId: string | null

  @column()
  public walletAddress: string | null

  @column()
  public currencyId: string | null

  @column()
  public bankAccountNo: string | null

  @column()
  public bankName: string | null

  @column()
  public accountName: string | null

  @column()
  public bankCode: string | null

  @column()
  public isDeleted: boolean = false

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

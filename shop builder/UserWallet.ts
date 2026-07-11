import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import { BaseModel, column, beforeCreate, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import User from './User'
import Currency from './Currency'

export default class UserWallet extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public userId: number

  @column()
  public currencyId: number

  @column()
  public balance: number

  @column()
  public status: 'active' | 'frozen' | 'closed'

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @belongsTo(() => Currency)
  public currency: BelongsTo<typeof Currency>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeCreate()
  public static assignUuid(wallet: UserWallet) {
    wallet.uniqueId = uuidv4()
  }
}

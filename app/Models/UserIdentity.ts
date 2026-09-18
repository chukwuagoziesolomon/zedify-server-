import { DateTime } from 'luxon'
import { BaseModel, belongsTo, BelongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import User from './User'

export default class UserIdentity extends BaseModel {
  public static table = 'user_identities'

  @column({ isPrimary: true })
  public id: number

  @column()
  public userId: number

  @column()
  public provider: 'ccc'

  @column()
  public network: 'mainnet' | 'testnet'

  @column()
  public subject: string

  @column()
  public address: string | null

  @column()
  public lockScript: string | null

  @column()
  public publicKey: string | null

  @column.dateTime()
  public verifiedAt: DateTime

  @column.dateTime()
  public lastAuthenticatedAt: DateTime

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>
}
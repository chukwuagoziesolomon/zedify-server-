import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@ioc:Adonis/Lucid/Orm'
import { HasMany } from '@ioc:Adonis/Lucid/Orm'
import Currency from './Currency'
import { genRandomUuid } from 'App/helpers/utils'

export default class CryptoNetwork extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public name: string

  @column()
  public logo: string

  @column()
  public rpcUrl: string

  @column()
  public isTestnet: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => Currency, {
    foreignKey: 'cryptoNetworkId',
  })
  public currencies: HasMany<typeof Currency>
}

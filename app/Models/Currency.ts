import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@ioc:Adonis/Lucid/Orm'
import { BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import CryptoNetwork from './CryptoNetwork'
import { genRandomUuid } from 'App/helpers/utils'
import { CurrencyType } from 'App/Lib/types'

export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public name: string

  @column()
  public symbol: string

  @column()
  public logo: string

  @column()
  public cryptoNetworkId: string

  @column()
  public type: CurrencyType

  @column()
  public ratePerUsd: number

  @column()
  public contractAddress: string | null

  @column()
  public isBlocked: boolean

  @column()
  public isDeleted: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => CryptoNetwork, {
    foreignKey: 'cryptoNetworkId',
    localKey: 'uniqueId', // <-- use uniqueId, not id
  })
  public cryptoNetwork: BelongsTo<typeof CryptoNetwork>
}

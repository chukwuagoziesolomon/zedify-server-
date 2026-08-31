import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@ioc:Adonis/Lucid/Orm'
import { HasMany } from '@ioc:Adonis/Lucid/Orm'
import Currency from './Currency'
import { genRandomUuid } from 'App/helpers/utils'

export type NetworkType = 'evm' | 'ckb' | 'solana' | 'tron'

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

  @column()
  public chainKey: string

  /** Discriminates routing: 'evm' for all EVM-compatible chains, 'ckb' for Nervos */
  @column()
  public networkType: NetworkType

  /** EVM chain ID (e.g. 1=Ethereum, 56=BSC, 137=Polygon). Null for non-EVM. */
  @column()
  public chainId: number | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => Currency, {
    foreignKey: 'cryptoNetworkId',
  })
  public currencies: HasMany<typeof Currency>
}

import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class SudtRegistry extends BaseModel {
  public static table = 'sudt_registry'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public typeScript: string // Unique identifier: "0x5e7a36..."

  @column()
  public symbol: string // "USDC", "FIBB", "wETH"

  @column()
  public name: string // "Wrapped USDC"

  @column()
  public decimals: number = 6

  @column()
  public logo: string

  @column()
  public network: string // "ckb-testnet", "ckb-mainnet"

  @column()
  public issuer?: string // Who issued this token

  @column()
  public website?: string

  @column()
  public enabled: boolean = true

  @column()
  public totalSupply?: string // In token units

  @column()
  public chainId?: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

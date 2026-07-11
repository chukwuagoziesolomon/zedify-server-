import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class BusinessAcceptedSudt extends BaseModel {
  public static table = 'business_accepted_sudt'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string

  @column()
  public sudtTypeScript: string // e.g., "0x5e7a36..."

  @column()
  public symbol: string // e.g., "USDC"

  @column()
  public name: string // e.g., "Wrapped USDC"

  @column()
  public logo: string // URL to token logo

  @column()
  public enabled: boolean = true

  @column()
  public minBalance: number = 0 // Min to keep in channel

  @column()
  public autoConvertEnabled: boolean = true

  @column()
  public status: string = 'active'

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { WalletType } from 'App/Lib/types'
import { genRandomUuid } from 'App/helpers/utils'

export default class Wallet extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public cryptoNetworkId: string

  @column()
  public walletAddress: string

  @column()
  public qrCodeUrl?: string

  @column()
  public paymentIntentId: string

  /**
   * Wallet type: 'master' is the main wallet where assets are flushed to; 'child' is used for individual payments.
   */
  @column()
  public type: WalletType

  @column()
  public userId: string // or businessId, depending on your naming

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

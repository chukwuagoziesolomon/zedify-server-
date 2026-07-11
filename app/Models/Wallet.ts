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

  /**
   * Reference ID for wallet reuse logic (e.g., payment-intent-id or business ref-id)
   */
  @column()
  public refId?: string

  /**
   * Expiration time for wallet session (DateTime)
   */
  @column.dateTime()
  public expiresAt?: DateTime

  /**
   * Whether this wallet is reusable (unused after session expiration)
   */
  @column()
  public reusable?: boolean

  /**
   * Status of the wallet (e.g., 'active', 'expired', 'flushed')
   */
  @column()
  public status?: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import CryptoNetwork from './CryptoNetwork'

/**
 * NOTE: this is the delta to merge into your existing Currency model —
 * you already have symbol / ratePerUsd / contractAddress / cryptoNetworkId etc.
 * (referenced throughout PaymentIndexerService). Only the fields below are new.
 */
export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public symbol: string // "RUSD" | "USDT" | "USDC" | ...

  @column()
  public ratePerUsd: number

  @column()
  public contractAddress: string | null

  @column()
  public cryptoNetworkId: number

  // --- new: stablecoin disclosure fields ---
  @column()
  public isStablecoin: boolean

  @column()
  public pegTarget: string | null // "USD"

  @column()
  public peggedBy: string | null // "Tether" | "Circle" | "CKB / Fiber ecosystem"

  @column()
  public backingInfo: string | null // short blurb shown at selection time, e.g.
  // "RUSD is a CKB-ecosystem stablecoin. Backing and redemption are managed by
  //  its issuer on the Fiber network — read more before treating it as USD-equivalent."

  @belongsTo(() => CryptoNetwork)
  public cryptoNetwork: BelongsTo<typeof CryptoNetwork>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

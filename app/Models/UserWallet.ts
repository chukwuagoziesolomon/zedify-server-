import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import User from 'App/Models/User'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Currency from 'App/Models/Currency'

/**
 * UserWallet Model
 * Represents a user's USDT savings account
 * - Permanent wallet (unlike temporary Wallet for payments)
 * - One wallet per user per blockchain network
 * - Tracks USDT balance and wallet address
 */
export default class UserWallet extends BaseModel {
  public static table = 'user_wallets'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public userId: number // FK → User.id

  @column()
  public cryptoNetworkId: string // FK → CryptoNetwork.uniqueId (BSC, Polygon, etc.)

  @column()
  public currencyId: string // FK → Currency.uniqueId (USDT, USDC)

  @column()
  public walletAddress: string // Immutable wallet address for receiving USDT

  @column()
  public balance: number // Current USDT balance (e.g., 1000.50)

  @column()
  public totalDeposited: number = 0 // Lifetime deposited amount

  @column()
  public totalWithdrawn: number = 0 // Lifetime withdrawn amount

  @column()
  public totalFiberReceived: number = 0 // Lifetime CKB/SUDT received via Fiber (in USDT)

  @column()
  public status: 'active' | 'inactive' | 'archived' = 'active'

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @belongsTo(() => CryptoNetwork)
  public cryptoNetwork: BelongsTo<typeof CryptoNetwork>

  @belongsTo(() => Currency)
  public currency: BelongsTo<typeof Currency>
}

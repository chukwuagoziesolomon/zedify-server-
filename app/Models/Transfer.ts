import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import User from 'App/Models/User'
import UserWallet from 'App/Models/UserWallet'

export enum TransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RecipientType {
  BANK_ACCOUNT = 'bank_account',
  USER_USDT = 'user_usdt',
  MERCHANT = 'merchant',
}

/**
 * Transfer Model
 * Records USDT transfers from user's wallet with conversion to Naira
 * Tracks:
 * - Source: User's USDT savings
 * - Amount: USDT amount being transferred
 * - Conversion: USDT → NGN rate & naira equivalent
 * - Recipient: Bank account, another user, or merchant
 * - Status: Lifecycle from pending to completed/failed
 */
export default class Transfer extends BaseModel {
  public static table = 'transfers'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public senderUserId: number // FK → User.id

  @column()
  public userWalletId: number // FK → UserWallet.id

  @column()
  public usdtAmount: number // Amount in USDT (e.g., 100.50)

  @column()
  public exchangeRate: number // USDT/NGN rate at time of transfer (e.g., 1560.50)

  @column()
  public nairaAmount: number // Equivalent Naira amount (usdtAmount * exchangeRate)

  @column()
  public fee: number = 0 // Optionally deducted fee in Naira

  @column()
  public recipientType: RecipientType // Type of recipient

  @column()
  public recipientName: string // Recipient name

  @column()
  public recipientAccountNumber?: string // Account number (if bank_account)

  @column()
  public recipientBankCode?: string // Bank code (if bank_account)

  @column()
  public recipientUserId?: number // User ID (if user_usdt)

  @column()
  public recipientReference?: string // Custom ref (email, phone, merchant ID)

  @column()
  public purpose?: string // Transfer purpose/description

  @column()
  public status: TransferStatus = TransferStatus.PENDING

  @column()
  public bankTransferRef?: string // Reference from bank/payout service

  @column.dateTime()
  public initiatedAt?: DateTime

  @column.dateTime()
  public processedAt?: DateTime

  @column.dateTime()
  public completedAt?: DateTime

  @column()
  public failureReason?: string // Error message if failed

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'senderUserId',
  })
  public sender: BelongsTo<typeof User>

  @belongsTo(() => UserWallet)
  public wallet: BelongsTo<typeof UserWallet>

  @belongsTo(() => User, {
    foreignKey: 'recipientUserId',
  })
  public recipientUser: BelongsTo<typeof User>
}

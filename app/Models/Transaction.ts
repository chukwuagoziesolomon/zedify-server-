import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import User from './User'
import UserWallet from './UserWallet'
import CryptoNetwork from './CryptoNetwork'
import Currency from './Currency'
import PaymentIntent from './PaymentIntent'

export type TransactionType = 'receive' | 'withdrawal'
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * Transaction Model
 * Comprehensive transaction tracking for both receiving and withdrawing funds.
 *
 * Use Cases:
 * 1. RECEIVE: Customer pays via QR code/wallet address
 *    - type: 'receive'
 *    - status: pending → processing → completed
 *    - Linked to PaymentIntent
 *    - Wallet address is generated and shown to customer
 *
 * 2. WITHDRAWAL: User withdraws to external address
 *    - type: 'withdrawal'
 *    - status: pending → processing → completed
 *    - Linked to Withdrawal
 *    - External recipient address
 *
 * 3. API DEPOSIT: External integration deposits funds
 *    - type: 'receive'
 *    - Via webhook or API call
 *    - Tracked same as customer payment
 */
export default class Transaction extends BaseModel {
  public static table = 'transactions'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  // ─── Core transaction data ─────────────────────────────────────────────

  @column()
  public userId: number // FK → User.id (the account holder)

  @column()
  public userWalletId: string | null // FK → UserWallet.uniqueId (optional: only for wallet-linked transactions)

  @column()
  public type: TransactionType // 'receive' | 'withdrawal'

  @column()
  public status: TransactionStatus = 'pending' // pending, processing, completed, failed, cancelled

  // ─── Amount & currency ─────────────────────────────────────────────────

  @column()
  public cryptoNetworkId: string // FK → CryptoNetwork.uniqueId (CKB, Ethereum, Polygon, etc.)

  @column()
  public currencyId: string // FK → Currency.uniqueId (CKB, USDT, RUSD, FIBB, etc.)

  @column()
  public amountCrypto: number // Amount in crypto units (e.g., 2000 CKB, 100 USDT)

  @column()
  public amountUsd: number // Converted to USD/USDT equivalent (for accounting)

  @column()
  public platformFeeUsd: number = 0 // 5% fee deducted (for receive transactions)

  @column()
  public netAmountUsd: number // amountUsd - platformFeeUsd (credited to wallet)

  // ─── Address/recipient tracking ────────────────────────────────────────

  @column()
  public walletAddressGenerated?: string // Generated address for customer to send to (receive only)

  @column()
  public recipientAddress?: string // Where funds are going (withdrawal only)

  @column()
  public senderAddress?: string // Where funds came from (receive transactions via on-chain)

  @column()
  public qrCodeData?: string // base64 encoded QR code (receive only)

  // ─── Blockchain tracking ──────────────────────────────────────────────

  @column()
  public txHash?: string // Transaction hash on blockchain

  @column()
  public paymentHash?: string // Fiber payment hash (CKB payments)

  @column()
  public invoiceAddress?: string // Fiber invoice address (CKB receive)

  @column()
  public sudtTypeScript?: string // SUDT token type script (for SUDT transfers)

  @column()
  public blockNumber?: number // Block number when confirmed

  @column()
  public confirmations?: number // Number of confirmations (for on-chain tx)

  // ─── Business/Reference tracking ──────────────────────────────────────

  @column()
  public paymentIntentId?: string // FK → PaymentIntent.uniqueId (if receive transaction)

  @column()
  public withdrawalId?: string // FK → Withdrawal.uniqueId (if withdrawal transaction)

  @column()
  public referenceId?: string // External reference (order ID, deposit ID, etc.)

  @column()
  public description?: string // Purpose/memo

  // ─── Status tracking ──────────────────────────────────────────────────

  @column()
  public errorMessage?: string // If failed, reason why

  @column()
  public retryCount: number = 0 // Number of retry attempts

  @column()
  public expiresAt?: DateTime // When address/invoice expires (receive only)

  @column.dateTime()
  public initiatedAt: DateTime = DateTime.now()

  @column.dateTime()
  public processedAt?: DateTime // When payment/withdrawal was detected/initiated

  @column.dateTime()
  public completedAt?: DateTime // When settled/confirmed

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // ─── Relationships ────────────────────────────────────────────────────

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @belongsTo(() => UserWallet, {
    foreignKey: 'userWalletId',
    localKey: 'uniqueId',
  })
  public wallet: BelongsTo<typeof UserWallet>

  @belongsTo(() => CryptoNetwork, {
    foreignKey: 'cryptoNetworkId',
    localKey: 'uniqueId',
  })
  public network: BelongsTo<typeof CryptoNetwork>

  @belongsTo(() => Currency, {
    foreignKey: 'currencyId',
    localKey: 'uniqueId',
  })
  public currency: BelongsTo<typeof Currency>

  @belongsTo(() => PaymentIntent, {
    foreignKey: 'paymentIntentId',
    localKey: 'uniqueId',
  })
  public paymentIntent: BelongsTo<typeof PaymentIntent>
}

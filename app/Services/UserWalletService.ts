import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import UserWallet from 'App/Models/UserWallet'
import BalanceLedger, { LedgerTransactionType } from 'App/Models/BalanceLedger'
import Currency from 'App/Models/Currency'

export interface CreditWalletParams {
  userId: number
  amount: number // Amount in USDT equivalent
  cryptoNetworkId?: string
  userWalletId?: string // If provided, credit this specific wallet instead of searching
  reference: string // Payment intent ID or transfer ID
  description: string
  metadata?: Record<string, any>
}

export interface DebitWalletParams {
  userWalletId: number
  amount: number // Amount in USDT
  reference: string
  description: string
  metadata?: Record<string, any>
}

export class UserWalletService {
  /**
   * Credit a user's wallet with a deposit amount.
   * Finds the user's active wallet for the given network (or any active wallet if not specified).
   * Creates a BalanceLedger entry for audit trail.
   */
  public async creditWallet(params: CreditWalletParams): Promise<UserWallet | null> {
    const { userId, amount, cryptoNetworkId, userWalletId, reference, description, metadata } = params

    if (amount <= 0) {
      Logger.warn(`[UserWalletService] Cannot credit zero or negative amount: ${amount}`)
      return null
    }

    let query = UserWallet.query()
      .where('userId', userId)
      .where('status', 'active')

    if (userWalletId) {
      query = query.where('uniqueId', userWalletId)
    } else if (cryptoNetworkId) {
      query = query.where('cryptoNetworkId', cryptoNetworkId)
    }

    const wallet = await query.first()

    if (!wallet) {
      Logger.warn(`[UserWalletService] No active wallet found for user ${userId} with walletId=${userWalletId || 'any'} network=${cryptoNetworkId || 'any'}`)
      return null
    }

    return await Database.transaction(async (trx) => {
      const lockedWallet = await UserWallet.query({ client: trx })
        .where('id', wallet.id)
        .forUpdate()
        .firstOrFail()

      const previousBalance = Number(lockedWallet.balance)
      const newBalance = parseFloat((previousBalance + amount).toFixed(6))

      lockedWallet.balance = newBalance
      lockedWallet.totalDeposited = parseFloat((Number(lockedWallet.totalDeposited) + amount).toFixed(6))
      await lockedWallet.useTransaction(trx).save()

      await BalanceLedger.create({
        userId: lockedWallet.userId,
        userWalletId: lockedWallet.id,
        type: LedgerTransactionType.DEPOSIT,
        amount,
        balanceAfter: newBalance,
        reference,
        description,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })

      Logger.info(
        `[UserWalletService] Credited ${amount} USDT to wallet ${lockedWallet.uniqueId} for user ${userId}. ` +
        `New balance: ${newBalance}`
      )

      return lockedWallet
    })
  }

  /**
   * Debit a user's wallet (for withdrawals, transfers, fees).
   * Creates a BalanceLedger entry for audit trail.
   */
  public async debitWallet(params: DebitWalletParams): Promise<UserWallet | null> {
    const { userWalletId, amount, reference, description, metadata } = params

    if (amount <= 0) {
      Logger.warn(`[UserWalletService] Cannot debit zero or negative amount: ${amount}`)
      return null
    }

    return await Database.transaction(async (trx) => {
      const wallet = await UserWallet.query({ client: trx })
        .where('id', userWalletId)
        .where('status', 'active')
        .forUpdate()
        .firstOrFail()

      const previousBalance = Number(wallet.balance)

      if (previousBalance < amount) {
        throw new Error(
          `Insufficient balance. Required: ${amount}, Available: ${previousBalance}`
        )
      }

      const newBalance = parseFloat((previousBalance - amount).toFixed(6))

      wallet.balance = newBalance
      wallet.totalWithdrawn = parseFloat((Number(wallet.totalWithdrawn) + amount).toFixed(6))
      await wallet.useTransaction(trx).save()

      await BalanceLedger.create({
        userId: wallet.userId,
        userWalletId: wallet.id,
        type: LedgerTransactionType.TRANSFER,
        amount,
        balanceAfter: newBalance,
        reference,
        description,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })

      Logger.info(
        `[UserWalletService] Debited ${amount} USDT from wallet ${wallet.id}. ` +
        `New balance: ${newBalance}`
      )

      return wallet
    })
  }

  /**
   * Get the current balance for a user's wallet.
   */
  public async getBalance(userId: number, cryptoNetworkId?: string): Promise<{
    walletId: number
    balance: number
    totalDeposited: number
    totalWithdrawn: number
    currency: string
  } | null> {
    const wallet = await UserWallet.query()
      .where('userId', userId)
      .where('status', 'active')
      .if(cryptoNetworkId, (q) => q.where('cryptoNetworkId', cryptoNetworkId!))
      .preload('currency')
      .first()

    if (!wallet) return null

    return {
      walletId: wallet.id,
      balance: Number(wallet.balance),
      totalDeposited: Number(wallet.totalDeposited),
      totalWithdrawn: Number(wallet.totalWithdrawn),
      currency: wallet.currency?.symbol || 'USDT',
    }
  }

  /**
   * Calculate the USDT equivalent of a fiat amount using the currency's ratePerUsd.
   */
  public async calculateUsdtEquivalent(fiatAmount: number, currencyId: string): Promise<number> {
    const currency = await Currency.query().where('uniqueId', currencyId).firstOrFail()
    // ratePerUsd is how much fiat = 1 USD
    // So USDT = fiatAmount / ratePerUsd
    const usdtAmount = fiatAmount / currency.ratePerUsd
    return parseFloat(usdtAmount.toFixed(6))
  }
}

export default new UserWalletService()

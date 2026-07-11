import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import Transaction from 'App/Models/Transaction'
import UserWallet from 'App/Models/UserWallet'

export interface CreateReceiveTransactionInput {
  userId: number
  userWalletId?: string
  cryptoNetworkId: string
  currencyId: string
  amountCrypto: number
  amountUsd: number
  walletAddressGenerated: string
  qrCodeData?: string
  paymentIntentId?: string
  referenceId?: string
  description?: string
  expiresAt?: DateTime
  invoiceAddress?: string
  sudtTypeScript?: string
}

export interface CreateWithdrawalTransactionInput {
  userId: number
  userWalletId?: string
  cryptoNetworkId: string
  currencyId: string
  amountCrypto: number
  amountUsd: number
  platformFeeUsd: number
  recipientAddress: string
  referenceId?: string
  description?: string
  sudtTypeScript?: string
}

export interface UpdateTransactionInput {
  transactionId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  txHash?: string
  paymentHash?: string
  blockNumber?: number
  confirmations?: number
  errorMessage?: string
  completedAt?: DateTime
}

/**
 * TransactionService
 * Handles creation and lifecycle management of transactions for:
 * - Receive transactions: Payment intents, API deposits, webhook payments
 * - Withdrawal transactions: User withdrawals to external addresses
 * 
 * All transactions track:
 * - Amount in crypto and USD
 * - Platform fee (for receives)
 * - Blockchain details (tx hash, block number)
 * - Status progression: pending → processing → completed/failed
 */
class TransactionServiceClass {
  /**
   * Create a receive transaction (customer pays business via QR/address)
   * Steps:
   * 1. Create transaction record with generated wallet address
   * 2. Calculate USD equivalent
   * 3. Store payment intent reference
   * 4. Set expiration time
   */
  async createReceiveTransaction(
    input: CreateReceiveTransactionInput
  ): Promise<Transaction> {
    try {
      Logger.info(
        `[TransactionService] Creating receive transaction: ${input.amountCrypto} ${input.currencyId} to ${input.walletAddressGenerated}`
      )

      const netAmountUsd = input.amountUsd * 0.95 // 5% fee deducted

      const transaction = await Transaction.create({
        userId: input.userId,
        userWalletId: input.userWalletId,
        type: 'receive',
        status: 'pending',
        cryptoNetworkId: input.cryptoNetworkId,
        currencyId: input.currencyId,
        amountCrypto: input.amountCrypto,
        amountUsd: input.amountUsd,
        platformFeeUsd: input.amountUsd * 0.05,
        netAmountUsd,
        walletAddressGenerated: input.walletAddressGenerated,
        qrCodeData: input.qrCodeData,
        paymentIntentId: input.paymentIntentId,
        referenceId: input.referenceId,
        description: input.description,
        expiresAt: input.expiresAt,
        invoiceAddress: input.invoiceAddress,
        sudtTypeScript: input.sudtTypeScript,
        initiatedAt: DateTime.now(),
      })

      Logger.info(
        `[TransactionService] Receive transaction created: ${transaction.uniqueId}`
      )
      return transaction
    } catch (error: any) {
      Logger.error(
        `[TransactionService] Failed to create receive transaction: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Create a withdrawal transaction (user withdraws to external address)
   * Steps:
   * 1. Create transaction record with recipient address
   * 2. Store platform fee and net amount
   * 3. Link to user's withdrawal request
   * 4. Status: pending (waiting for OTP/confirmation)
   */
  async createWithdrawalTransaction(
    input: CreateWithdrawalTransactionInput
  ): Promise<Transaction> {
    try {
      Logger.info(
        `[TransactionService] Creating withdrawal transaction: ${input.amountCrypto} to ${input.recipientAddress}`
      )

      const transaction = await Transaction.create({
        userId: input.userId,
        userWalletId: input.userWalletId,
        type: 'withdrawal',
        status: 'pending',
        cryptoNetworkId: input.cryptoNetworkId,
        currencyId: input.currencyId,
        amountCrypto: input.amountCrypto,
        amountUsd: input.amountUsd,
        platformFeeUsd: input.platformFeeUsd,
        netAmountUsd: input.amountUsd - input.platformFeeUsd,
        recipientAddress: input.recipientAddress,
        referenceId: input.referenceId,
        description: input.description,
        sudtTypeScript: input.sudtTypeScript,
        initiatedAt: DateTime.now(),
      })

      Logger.info(
        `[TransactionService] Withdrawal transaction created: ${transaction.uniqueId}`
      )
      return transaction
    } catch (error: any) {
      Logger.error(
        `[TransactionService] Failed to create withdrawal transaction: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Update transaction status (payment detected, settled, failed, etc.)
   */
  async updateTransactionStatus(
    input: UpdateTransactionInput
  ): Promise<Transaction> {
    try {
      const transaction = await Transaction.query()
        .where('uniqueId', input.transactionId)
        .firstOrFail()

      transaction.status = input.status
      if (input.txHash) transaction.txHash = input.txHash
      if (input.paymentHash) transaction.paymentHash = input.paymentHash
      if (input.blockNumber) transaction.blockNumber = input.blockNumber
      if (input.confirmations !== undefined) transaction.confirmations = input.confirmations
      if (input.errorMessage) transaction.errorMessage = input.errorMessage
      if (input.completedAt) transaction.completedAt = input.completedAt

      if (input.status === 'processing' && !transaction.processedAt) {
        transaction.processedAt = DateTime.now()
      }
      if (input.status === 'completed' && !transaction.completedAt) {
        transaction.completedAt = DateTime.now()
      }

      await transaction.save()

      Logger.info(
        `[TransactionService] Transaction updated: ${input.transactionId} → ${input.status}`
      )
      return transaction
    } catch (error: any) {
      Logger.error(
        `[TransactionService] Failed to update transaction: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Mark transaction as completed after payment confirmed
   * For receive transactions: add amountUsd to wallet balance
   * For withdrawal transactions: balance already deducted during initiation
   */
  async completeTransaction(transactionId: string): Promise<Transaction> {
    const trx = await Database.transaction()

    try {
      const transaction = await Transaction.query(trx)
        .where('uniqueId', transactionId)
        .forUpdate()
        .firstOrFail()

      if (transaction.status === 'completed') {
        Logger.warn(`[TransactionService] Transaction already completed: ${transactionId}`)
        return transaction
      }

      // If receive transaction, credit wallet
      if (transaction.type === 'receive' && transaction.userWalletId) {
        const wallet = await UserWallet.query(trx)
          .where('uniqueId', transaction.userWalletId)
          .forUpdate()
          .firstOrFail()

        wallet.balance = parseFloat((Number(wallet.balance) + transaction.netAmountUsd).toFixed(6))
        wallet.totalFiberReceived = parseFloat(
          (Number(wallet.totalFiberReceived || 0) + transaction.netAmountUsd).toFixed(6)
        )
        await wallet.save()

        Logger.info(
          `[TransactionService] Wallet credited: ${wallet.uniqueId} +${transaction.netAmountUsd} USD`
        )
      }

      // Update transaction
      transaction.status = 'completed'
      transaction.completedAt = DateTime.now()
      await transaction.save()

      await trx.commit()

      Logger.info(`[TransactionService] Transaction completed: ${transactionId}`)
      return transaction
    } catch (error: any) {
      await trx.rollback()
      Logger.error(
        `[TransactionService] Failed to complete transaction: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Mark transaction as failed with reason
   */
  async failTransaction(transactionId: string, errorMessage: string): Promise<Transaction> {
    try {
      const transaction = await Transaction.query()
        .where('uniqueId', transactionId)
        .firstOrFail()

      transaction.status = 'failed'
      transaction.errorMessage = errorMessage
      transaction.completedAt = DateTime.now()
      await transaction.save()

      Logger.warn(
        `[TransactionService] Transaction failed: ${transactionId} - ${errorMessage}`
      )
      return transaction
    } catch (error: any) {
      Logger.error(
        `[TransactionService] Failed to mark transaction as failed: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: number,
    filters?: {
      type?: 'receive' | 'withdrawal'
      status?: string
      networkId?: string
      page?: number
      limit?: number
    }
  ) {
    try {
      let query = Transaction.query().where('user_id', userId)

      if (filters?.type) query = query.where('type', filters.type)
      if (filters?.status) query = query.where('status', filters.status)
      if (filters?.networkId) query = query.where('crypto_network_id', filters.networkId)

      const page = filters?.page || 1
      const limit = filters?.limit || 20

      const transactions = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return transactions
    } catch (error: any) {
      Logger.error(`[TransactionService] Failed to get transaction history: ${error.message}`)
      throw error
    }
  }

  /**
   * Get single transaction
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    try {
      const transaction = await Transaction.query()
        .where('uniqueId', transactionId)
        .firstOrFail()

      return transaction
    } catch (error: any) {
      Logger.error(`[TransactionService] Failed to get transaction: ${error.message}`)
      throw error
    }
  }
}

export default new TransactionServiceClass()

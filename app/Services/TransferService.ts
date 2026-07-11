import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import UserWallet from 'App/Models/UserWallet'
import Transfer, { TransferStatus, RecipientType } from 'App/Models/Transfer'
import User from 'App/Models/User'
import ConversionService from './ConversionService'
import EmailNotificationService from './EmailNotificationService'
import PayoutService from './PayoutService'
import { v4 as uuid } from 'uuid'

export interface InitiateTransferInput {
  userId: number
  userWalletId: number
  usdtAmount: number
  recipientType: 'bank_account' | 'user_usdt' | 'merchant'
  recipientName?: string
  recipientAccountNumber?: string
  recipientBankCode?: string
  recipientUserId?: number
  recipientReference?: string
  purpose?: string
}

export interface TransferResponse {
  transferId: string
  status: string
  usdtAmount: number
  exchangeRate: number
  nairaAmount: number
  fee: number
  estimatedSettlementTime: string
  message: string
}

/**
 * TransferService
 * Handles USDT transfer logic: validation, conversion, balance deduction, settlement
 * Supports bank transfers, P2P (user to user), and merchant payments
 */
class TransferServiceClass {
  private readonly TRANSFER_FEE_PERCENTAGE = 0.01 // 1% fee

  /**
   * Initiate a new transfer
   * Steps:
   * 1. Validate user wallet exists and has sufficient balance
   * 2. Get current USDT→NGN exchange rate
   * 3. Calculate Naira equivalent and fee
   * 4. Deduct USDT from wallet (database transaction)
   * 5. Create Transfer record
   * 6. Trigger settlement based on recipient type
   * 7. Send notification to user
   */
  async initiateTransfer(
    input: InitiateTransferInput
  ): Promise<TransferResponse> {
    const trx = await Database.transaction()

    try {
      Logger.info(
        `[TransferService] Initiating transfer for user ${input.userId}: ${input.usdtAmount} USDT`
      )

      // Step 1: Validate wallet exists and has balance
      const wallet = await UserWallet.query(trx)
        .where('id', input.userWalletId)
        .where('userId', input.userId)
        .where('status', 'active')
        .forUpdate()
        .first()

      if (!wallet) {
        throw new Error('Wallet not found or inactive')
      }

      if (wallet.balance < input.usdtAmount) {
        throw new Error(
          `Insufficient balance. Available: ${wallet.balance} USDT`
        )
      }

      // Step 2: Get exchange rate
      const conversion = await ConversionService.convertUsdtToNaira(
        input.usdtAmount,
        wallet.cryptoNetworkId
      )

      // Step 3: Calculate fee and final amount
      const fee = parseFloat((input.usdtAmount * this.TRANSFER_FEE_PERCENTAGE).toFixed(6))
      const finalUsdtAmount = input.usdtAmount - fee
      const nairaAmount = parseFloat(
        (conversion.toAmount * (1 - this.TRANSFER_FEE_PERCENTAGE)).toFixed(2)
      )

      Logger.info(
        `[TransferService] Exchange rate: 1 USDT = ${conversion.exchangeRate.toFixed(2)} NGN, Fee: ${fee} USDT`
      )

      // Step 4: Deduct from wallet (atomic operation)
      wallet.balance = parseFloat((wallet.balance - input.usdtAmount).toFixed(6))
      wallet.totalWithdrawn = parseFloat(
        (wallet.totalWithdrawn + input.usdtAmount).toFixed(6)
      )
      await wallet.useTransaction(trx).save()

      // Step 5: Create Transfer record
      const transfer = new Transfer()
      transfer.uniqueId = uuid()
      transfer.senderUserId = input.userId
      transfer.userWalletId = input.userWalletId
      transfer.usdtAmount = finalUsdtAmount
      transfer.exchangeRate = conversion.exchangeRate
      transfer.nairaAmount = nairaAmount
      transfer.fee = fee
      transfer.recipientType = input.recipientType as RecipientType
      if (input.recipientName) {
        transfer.recipientName = input.recipientName
      }
      transfer.recipientAccountNumber = input.recipientAccountNumber
      transfer.recipientBankCode = input.recipientBankCode
      transfer.recipientUserId = input.recipientUserId
      transfer.recipientReference = input.recipientReference
      transfer.purpose = input.purpose || 'User initiated transfer'
      transfer.status = TransferStatus.PENDING
      transfer.initiatedAt = DateTime.now()

      await transfer.useTransaction(trx).save()

      // Step 6: Commit transaction
      await trx.commit()

      // Step 7: Async settlement (doesn't block response)
      this.settleTransfer(transfer, input.userId).catch((err) => {
        Logger.error(
          `[TransferService] Settlement failed for transfer ${transfer.uniqueId}: ${err}`
        )
      })

      // Step 8: Send notification
      await this.notifyTransferInitiated(input.userId, transfer, nairaAmount)

      return {
        transferId: transfer.uniqueId,
        status: transfer.status,
        usdtAmount: finalUsdtAmount,
        exchangeRate: conversion.exchangeRate,
        nairaAmount: nairaAmount,
        fee: fee,
        estimatedSettlementTime: this.getEstimatedSettlementTime(input.recipientType),
        message: `Transfer of ${input.usdtAmount} USDT initiated. You will receive ₦${nairaAmount.toFixed(2)} after settlement.`,
      }
    } catch (error) {
      await trx.rollback()
      Logger.error(`[TransferService] Transfer initiation failed: ${error}`)
      throw error
    }
  }

  /**
   * Cancel a pending transfer (refund USDT to wallet)
   */
  async cancelTransfer(transferId: string, userId: number): Promise<void> {
    const trx = await Database.transaction()

    try {
      Logger.info(
        `[TransferService] Cancelling transfer ${transferId} for user ${userId}`
      )

      // Get transfer
      const transfer = await Transfer.query(trx)
        .where('uniqueId', transferId)
        .where('senderUserId', userId)
        .where('status', TransferStatus.PENDING)
        .forUpdate()
        .first()

      if (!transfer) {
        throw new Error('Transfer not found or cannot be cancelled')
      }

      // Get user wallet
      const wallet = await UserWallet.query(trx)
        .where('id', transfer.userWalletId)
        .forUpdate()
        .first()

      if (!wallet) {
        throw new Error('Wallet not found')
      }

      // Refund USDT (original amount + fee)
      const refundAmount = transfer.usdtAmount + transfer.fee
      wallet.balance = parseFloat((wallet.balance + refundAmount).toFixed(6))
      wallet.totalWithdrawn = parseFloat(
        (wallet.totalWithdrawn - refundAmount).toFixed(6)
      )
      await wallet.useTransaction(trx).save()

      // Update transfer status
      transfer.status = TransferStatus.CANCELLED
      await transfer.useTransaction(trx).save()

      await trx.commit()

      Logger.info(
        `[TransferService] Transfer ${transferId} cancelled, refunded ${refundAmount} USDT`
      )

      await this.notifyTransferCancelled(userId, transfer)
    } catch (error) {
      await trx.rollback()
      Logger.error(`[TransferService] Cancel transfer failed: ${error}`)
      throw error
    }
  }

  /**
   * Handle settlement based on recipient type
   * This method runs asynchronously after transfer creation
   */
  private async settleTransfer(
    transfer: Transfer,
    userId: number
  ): Promise<void> {
    try {
      Logger.info(
        `[TransferService] Starting settlement for transfer ${transfer.uniqueId}`
      )

      // Update to processing status
      transfer.status = TransferStatus.PROCESSING
      transfer.processedAt = DateTime.now()
      await transfer.save()

      // Route to appropriate settlement handler
      switch (transfer.recipientType) {
        case RecipientType.BANK_ACCOUNT:
          await this.settleToBank(transfer)
          break

        case RecipientType.USER_USDT:
          await this.settleToUser(transfer)
          break

        case RecipientType.MERCHANT:
          await this.settleToMerchant(transfer)
          break
      }

      transfer.status = TransferStatus.COMPLETED
      transfer.completedAt = DateTime.now()
      await transfer.save()

      await this.notifyTransferCompleted(userId, transfer)
    } catch (error) {
      Logger.error(
        `[TransferService] Settlement failed for ${transfer.uniqueId}: ${error}`
      )
      transfer.status = TransferStatus.FAILED
      await transfer.save()

      await this.notifyTransferFailed(userId, transfer, error)
    }
  }

  /**
   * Settle transfer to bank account
   * Initiates bank transfer via Paystack/Moniepoint
   */
  private async settleToBank(transfer: Transfer): Promise<void> {
    try {
      Logger.info(
        `[TransferService] Settling to bank: ${transfer.recipientAccountNumber} (${transfer.recipientBankCode})`
      )

      if (!transfer.recipientAccountNumber || !transfer.recipientBankCode) {
        throw new Error('Bank account details missing')
      }

      // Initiate payout via PayoutService
      const payoutResult = await PayoutService.payoutToBank({
        transferId: transfer.uniqueId,
        nairaAmount: transfer.nairaAmount,
        recipient: {
          type: 'bank_account',
          bankAccount: {
            accountNumber: transfer.recipientAccountNumber,
            bankCode: transfer.recipientBankCode,
            accountName: transfer.recipientName,
          },
        },
      })

      if (!payoutResult.success) {
        throw new Error(`Payout failed: ${payoutResult.message}`)
      }

      // Store payout reference for webhook tracking
      transfer.bankTransferRef = payoutResult.payoutId
      Logger.info(
        `[TransferService] Bank settlement initiated: ${payoutResult.payoutId}`
      )
    } catch (error) {
      Logger.error(`[TransferService] Bank settlement failed: ${error}`)
      throw error
    }
  }

  /**
   * Settle transfer to another user's USDT wallet
   */
  private async settleToUser(transfer: Transfer): Promise<void> {
    if (!transfer.recipientUserId) {
      throw new Error('Recipient user ID missing')
    }

    Logger.info(
      `[TransferService] Settling to user wallet: ${transfer.recipientUserId}`
    )

    const trx = await Database.transaction()

    try {
      // Get recipient wallet (same crypto network)
      const senderWallet = await UserWallet.find(transfer.userWalletId)
      if (!senderWallet) {
        throw new Error('Sender wallet not found')
      }

      const recipientWallet = await UserWallet.query(trx)
        .where('userId', transfer.recipientUserId)
        .where('cryptoNetworkId', senderWallet.cryptoNetworkId)
        .where('status', 'active')
        .forUpdate()
        .first()

      if (!recipientWallet) {
        throw new Error('Recipient wallet not found')
      }

      // Credit recipient
      recipientWallet.balance = parseFloat(
        (recipientWallet.balance + transfer.usdtAmount).toFixed(6)
      )
      recipientWallet.totalDeposited = parseFloat(
        (recipientWallet.totalDeposited + transfer.usdtAmount).toFixed(6)
      )
      await recipientWallet.useTransaction(trx).save()

      await trx.commit()

      Logger.info(
        `[TransferService] Credited ${transfer.usdtAmount} USDT to user ${transfer.recipientUserId}`
      )
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Settle transfer to merchant
   * TODO: Implement merchant settlement logic (likely tied to merchant bank account)
   */
  private async settleToMerchant(transfer: Transfer): Promise<void> {
    Logger.info(
      `[TransferService] Settling to merchant: ${transfer.recipientReference}`
    )

    // TODO: Implement merchant settlement
    // For now, just log
    transfer.bankTransferRef = `MERCH_${transfer.uniqueId}`
  }

  /**
   * Get estimated settlement time based on recipient type
   */
  private getEstimatedSettlementTime(recipientType: string): string {
    switch (recipientType) {
      case 'bank_account':
        return '5-10 minutes'
      case 'user_usdt':
        return 'Instant'
      case 'merchant':
        return '1-2 minutes'
      default:
        return 'Unknown'
    }
  }

  /**
   * Notification helpers
   */
  private async notifyTransferInitiated(
    userId: number,
    transfer: Transfer,
    _nairaAmount: number
  ): Promise<void> {
    try {
      await EmailNotificationService.sendTransferInitiatedEmail(transfer)
      Logger.info(
        `[TransferService] Transfer initiated notification sent for user ${userId}`
      )
    } catch (error) {
      Logger.warn(`[TransferService] Failed to send initiated notification: ${error}`)
    }
  }

  private async notifyTransferCompleted(
    userId: number,
    transfer: Transfer
  ): Promise<void> {
    try {
      await EmailNotificationService.sendTransferCompletedEmail(transfer)
      Logger.info(
        `[TransferService] Transfer completed notification sent for user ${userId}`
      )
    } catch (error) {
      Logger.warn(`[TransferService] Failed to send completed notification: ${error}`)
    }
  }

  private async notifyTransferCancelled(
    userId: number,
    _transfer: Transfer
  ): Promise<void> {
    try {
      const user = await User.find(userId)
      if (!user) return

      Logger.info(`[TransferService] Transfer cancelled for user ${userId}`)
      // Cancellation is typically silent or shown in-app only
    } catch (error) {
      Logger.warn(`[TransferService] Failed to handle cancellation: ${error}`)
    }
  }

  private async notifyTransferFailed(
    userId: number,
    transfer: Transfer,
    _error: any
  ): Promise<void> {
    try {
      await EmailNotificationService.sendTransferFailedEmail(transfer)
      Logger.info(
        `[TransferService] Transfer failed notification sent for user ${userId}`
      )
    } catch (err) {
      Logger.warn(`[TransferService] Failed to send failed notification: ${err}`)
    }
  }
}

export default new TransferServiceClass()

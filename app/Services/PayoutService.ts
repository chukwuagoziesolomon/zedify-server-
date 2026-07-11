import Logger from '@ioc:Adonis/Core/Logger'
import Transfer from 'App/Models/Transfer'
import { v4 as uuid } from 'uuid'

export interface BankAccount {
  accountNumber: string
  bankCode: string
  accountName?: string
}

export interface PayoutRecipient {
  type: 'bank_account' | 'user_usdt' | 'merchant'
  bankAccount?: BankAccount
  userId?: number
  merchantId?: string
}

export interface PayoutPayload {
  transferId: string
  nairaAmount: number
  recipient: PayoutRecipient
}

export interface PayoutResponse {
  success: boolean
  payoutId: string
  status: string
  transactionId?: string
  message: string
}

/**
 * PayoutService
 * Handles bank settlements via Paystack/Moniepoint
 * Integrates with secondary settlement providers for Naira transfers
 */
class PayoutServiceClass {
  private readonly PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY
  private readonly PAYSTACK_BASE_URL = 'https://api.paystack.co'
  private readonly _MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY
  private readonly _MONIEPOINT_BASE_URL = 'https://api.moniepoint.com'

  /**
   * Process payout to bank account
   * Steps:
   * 1. Validate bank account details
   * 2. Create/resolve recipient code on Paystack/Moniepoint
   * 3. Initiate transfer
   * 4. Return transaction reference
   */
  async payoutToBank(payload: PayoutPayload): Promise<PayoutResponse> {
    try {
      if (!payload.recipient.bankAccount) {
        throw new Error('Bank account details missing')
      }

      const { accountNumber, bankCode, accountName } = payload.recipient.bankAccount

      Logger.info(
        `[PayoutService] Initiating payout: ${payload.nairaAmount} NGN to ${accountNumber}`
      )

      // Note: Choose provider based on configuration or bank code coverage
      // For now, default to Paystack
      const result = await this.payoutViaPaystack({
        transferId: payload.transferId,
        nairaAmount: payload.nairaAmount,
        accountNumber,
        bankCode,
        accountName,
      })

      return result
    } catch (error) {
      Logger.error(`[PayoutService] Payout failed: ${error}`)
      throw error
    }
  }

  /**
   * Paystack integration for bank transfers
   * @requires PAYSTACK_SECRET_KEY environment variable
   */
  private async payoutViaPaystack({
    transferId,
    nairaAmount,
    accountNumber,
    bankCode,
    accountName,
  }: {
    transferId: string
    nairaAmount: number
    accountNumber: string
    bankCode: string
    accountName?: string
  }): Promise<PayoutResponse> {
    try {
      if (!this.PAYSTACK_API_KEY) {
        throw new Error('Paystack API key not configured')
      }

      // Step 1: Verify bank account (optional but recommended)
      await this.verifyPaystackAccount(accountNumber, bankCode)

      // Step 2: Create transfer recipient
      const recipientResponse = await this.createPaystackRecipient({
        accountNumber,
        bankCode,
        accountName: accountName || `User ${transferId}`,
      })

      if (!recipientResponse.success) {
        throw new Error(`Failed to create recipient: ${recipientResponse.message}`)
      }

      const recipientCode = recipientResponse.data.recipient_code

      // Step 3: Initiate transfer
      const transferPaystackId = uuid()
      const transferResponse = await this.initiatePaystackTransfer({
        source: 'balance', // Using account balance
        reason: `Transfer ${transferId}`,
        amount: Math.round(nairaAmount * 100), // Paystack expects amount in kobo
        recipient: recipientCode,
        reference: transferPaystackId,
      })

      if (!transferResponse.success) {
        throw new Error(`Transfer initiation failed: ${transferResponse.message}`)
      }

      Logger.info(
        `[PayoutService] Paystack transfer initiated: ${transferPaystackId} → ${recipientCode}`
      )

      return {
        success: true,
        payoutId: transferPaystackId,
        status: transferResponse.data.status,
        transactionId: transferResponse.data.reference,
        message: 'Bank transfer initiated successfully. Settlement in 1-3 minutes.',
      }
    } catch (error) {
      Logger.error(`[PayoutService] Paystack payout failed: ${error}`)
      throw error
    }
  }

  /**
   * Verify account exists on Paystack
   */
  private async verifyPaystackAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
          },
        }
      )

      const data = await response.json()

      if (!data.status) {
        throw new Error(`Account verification failed: ${data.message}`)
      }

      Logger.info(`[PayoutService] Account verified: ${data.data.account_name}`)
      return data.data
    } catch (error) {
      Logger.warn(`[PayoutService] Account verification warning: ${error}`)
      // Don't throw - allow transfer even if verification fails
      return null
    }
  }

  /**
   * Create Paystack transfer recipient
   */
  private async createPaystackRecipient({
    accountNumber,
    bankCode,
    accountName,
  }: {
    accountNumber: string
    bankCode: string
    accountName: string
  }): Promise<any> {
    const response = await fetch(`${this.PAYSTACK_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
      }),
    })

    return await response.json()
  }

  /**
   * Initiate transfer on Paystack
   */
  private async initiatePaystackTransfer({
    source,
    reason,
    amount,
    recipient,
    reference,
  }: {
    source: string
    reason: string
    amount: number
    recipient: string
    reference: string
  }): Promise<any> {
    const response = await fetch(`${this.PAYSTACK_BASE_URL}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source,
        reason,
        amount,
        recipient,
        reference,
      }),
    })

    return await response.json()
  }

  /**
   * Finalize transfer on Paystack (OTP verification)
   * Called after user provides OTP
   */
  async finalizePaystackTransfer(
    transferCode: string,
    otp: string
  ): Promise<PayoutResponse> {
    try {
      const response = await fetch(`${this.PAYSTACK_BASE_URL}/transfer/finalize_transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transfer_code: transferCode,
          otp,
        }),
      })

      const data = await response.json()

      if (!data.status) {
        throw new Error(`OTP verification failed: ${data.message}`)
      }

      Logger.info(`[PayoutService] Transfer finalized: ${transferCode}`)

      return {
        success: true,
        payoutId: transferCode,
        status: data.data.status,
        transactionId: data.data.reference,
        message: 'Transfer completed successfully',
      }
    } catch (error) {
      Logger.error(`[PayoutService] Finalize transfer failed: ${error}`)
      throw error
    }
  }

  /**
   * Verify transfer status on Paystack
   */
  async verifyPaystackTransfer(reference: string): Promise<any> {
    try {
      const response = await fetch(`${this.PAYSTACK_BASE_URL}/transfer/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
        },
      })

      const data = await response.json()

      if (!data.status) {
        throw new Error(`Verification failed: ${data.message}`)
      }

      Logger.info(`[PayoutService] Transfer verified: ${reference} → ${data.data.status}`)
      return data.data
    } catch (error) {
      Logger.error(`[PayoutService] Transfer verification failed: ${error}`)
      throw error
    }
  }

  /**
   * Handle webhook notification from Paystack
   * Called when transfer status changes
   */
  async handlePaystackWebhook(payload: any): Promise<void> {
    try {
      const event = payload.event
      const data = payload.data

      Logger.info(`[PayoutService] Webhook received: ${event}`)

      if (event === 'transfer.success') {
        await this.updateTransferStatus(data.reference, 'completed', data.id)
      } else if (event === 'transfer.failed') {
        await this.updateTransferStatus(data.reference, 'failed', data.id, data.reason)
      } else if (event === 'transfer.reversed') {
        await this.updateTransferStatus(data.reference, 'cancelled', data.id, 'Transfer reversed')
      }
    } catch (error) {
      Logger.error(`[PayoutService] Webhook handling failed: ${error}`)
    }
  }

  /**
   * Update transfer status in database
   */
  private async updateTransferStatus(
    reference: string,
    status: 'completed' | 'failed' | 'cancelled',
    _paystackId?: string,
    failureReason?: string
  ): Promise<void> {
    try {
      // Find transfer by bankTransferRef (which would store the Paystack reference)
      const transfer = await Transfer.query()
        .where('bankTransferRef', reference)
        .first()

      if (!transfer) {
        Logger.warn(`[PayoutService] Transfer not found: ${reference}`)
        return
      }

      transfer.status = status as any
      if (failureReason) {
        transfer.failureReason = failureReason
      }

      await transfer.save()

      Logger.info(`[PayoutService] Transfer status updated: ${reference} → ${status}`)
    } catch (error) {
      Logger.error(`[PayoutService] Status update failed: ${error}`)
    }
  }

  /**
   * Get available banks on Paystack
   * Useful for frontend bank selection dropdown
   */
  async getBanks(): Promise<any[]> {
    try {
      const response = await fetch(`${this.PAYSTACK_BASE_URL}/bank?currency=NGN`, {
        headers: {
          Authorization: `Bearer ${this.PAYSTACK_API_KEY}`,
        },
      })

      const data = await response.json()

      if (!data.status) {
        throw new Error('Failed to fetch banks')
      }

      return data.data.map((bank: any) => ({
        code: bank.code,
        name: bank.name,
        longCode: bank.longcode,
      }))
    } catch (error) {
      Logger.error(`[PayoutService] Failed to fetch banks: ${error}`)
      return []
    }
  }
}

export default new PayoutServiceClass()

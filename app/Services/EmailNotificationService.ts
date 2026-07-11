import Logger from '@ioc:Adonis/Core/Logger'
import { NotificationService } from 'App/Lib/notification/notification'
import PaymentIntent from 'App/Models/PaymentIntent'
import Transfer from 'App/Models/Transfer'
import User from 'App/Models/User'
import Admin from 'App/Models/Admin'

interface PaymentConfirmationData {
  paymentId: string
  businessReferenceId: string
  fiatAmount: number
  fiatCurrency: string
  cryptoAmount: number
  cryptoCurrency: string
  walletAddress: string
  confirmedAt: Date
  transactionHash: string
}

export class EmailNotificationService {
  private notificationService = new NotificationService()

  async sendPaymentConfirmationEmail(
    paymentIntent: PaymentIntent,
    data: PaymentConfirmationData
  ): Promise<void> {
    try {
      // businessId is the userId (uniqueId string)
      const user = await User.query().where('uniqueId', paymentIntent.businessId).firstOrFail()

      const emailData = {
        businessName: user.businessName,
        userEmail: user.email,
        paymentId: data.paymentId,
        businessRefId: data.businessReferenceId,
        fiatAmount: data.fiatAmount.toFixed(2),
        fiatCurrency: data.fiatCurrency,
        cryptoAmount: data.cryptoAmount.toFixed(8),
        cryptoCurrency: data.cryptoCurrency,
        walletAddress: data.walletAddress,
        confirmedAt: new Date(data.confirmedAt).toLocaleString(),
        transactionHash: data.transactionHash,
        explorerUrl: this.getExplorerUrl(data.transactionHash, paymentIntent),
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Payment Confirmation - ${emailData.businessRefId}`,
        template: 'payment_received',
        replacements: emailData,
      })

      Logger.info(
        `[EmailNotification] Payment confirmation sent to ${user.email}`
      )
    } catch (error) {
      Logger.error(
        `[EmailNotification] Failed to send payment confirmation: ${error}`
      )
      throw error
    }
  }

  /**
   * Send payment received notification to admin
   */
  async sendAdminPaymentNotification(
    paymentIntent: PaymentIntent,
    data: PaymentConfirmationData
  ): Promise<void> {
    try {
      // Send to all admins
      const admins = await Admin.all()

      for (const admin of admins) {
        const emailData = {
          adminName: admin.email.split('@')[0], // Use email prefix as name
          businessId: paymentIntent.businessId,
          paymentId: data.paymentId,
          businessRefId: data.businessReferenceId,
          fiatAmount: data.fiatAmount.toFixed(2),
          fiatCurrency: data.fiatCurrency,
          cryptoAmount: data.cryptoAmount.toFixed(8),
          cryptoCurrency: data.cryptoCurrency,
          transactionHash: data.transactionHash,
          explorerUrl: this.getExplorerUrl(
            data.transactionHash,
            paymentIntent
          ),
          confirmedAt: new Date(data.confirmedAt).toLocaleString(),
        }

        await this.notificationService.sendEmail({
          to: admin.email,
          subject: `[Admin] Payment Received - ${data.paymentId}`,
          template: 'admin_payment_received',
          replacements: emailData,
        })
      }

      Logger.info(`[EmailNotification] Admin notifications sent`)
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send admin notification: ${error}`
      )
      // Don't throw - admin notifications are secondary
    }
  }

  /**
   * Send payment failure/expiration notice
   */
  async sendPaymentExpiredEmail(paymentIntent: PaymentIntent): Promise<void> {
    try {
      // businessId is the userId (uniqueId string)
      const user = await User.query().where('uniqueId', paymentIntent.businessId).firstOrFail()

      const emailData = {
        businessName: user.businessName,
        paymentId: paymentIntent.uniqueId,
        businessRefId: paymentIntent.businessReferenceId,
        fiatAmount: paymentIntent.fiatAmount.toFixed(2),
        fiatCurrency: paymentIntent.fiatCurrencyId,
        expiredAt: paymentIntent.createdAt.plus({ hours: 1 }).toISO(),
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Payment Expired - ${emailData.businessRefId}`,
        template: 'payment_expired',
        replacements: emailData,
      })

      Logger.info(
        `[EmailNotification] Payment expired email sent to ${user.email}`
      )
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send payment expired email: ${error}`
      )
    }
  }

  /**
   * Send transfer initiated notification
   */
  async sendTransferInitiatedEmail(transfer: Transfer): Promise<void> {
    try {
      const user = await User.findOrFail(transfer.senderUserId)

      const emailData = {
        transferId: transfer.uniqueId,
        usdtAmount: transfer.usdtAmount.toFixed(6),
        exchangeRate: transfer.exchangeRate.toFixed(2),
        nairaAmount: transfer.nairaAmount.toFixed(2),
        fee: transfer.fee.toFixed(6),
        recipientName: transfer.recipientName || 'Unknown',
        recipientType: transfer.recipientType,
        recipientAccountNumber: transfer.recipientAccountNumber || 'N/A',
        recipientBankCode: transfer.recipientBankCode || 'N/A',
        estimatedTime: this.getEstimatedSettlementTime(transfer.recipientType),
        purpose: transfer.purpose || 'USDT Transfer',
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Transfer Initiated - ${transfer.uniqueId.substring(0, 8)}`,
        template: 'transfer_initiated',
        replacements: emailData,
      })

      Logger.info(
        `[EmailNotification] Transfer initiated email sent to ${user.email}`
      )
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send transfer initiated email: ${error}`
      )
      // Don't throw - notifications are non-blocking
    }
  }

  /**
   * Send transfer completed notification
   */
  async sendTransferCompletedEmail(transfer: Transfer): Promise<void> {
    try {
      const user = await User.findOrFail(transfer.senderUserId)

      const emailData = {
        transferId: transfer.uniqueId,
        usdtAmount: transfer.usdtAmount.toFixed(6),
        nairaAmount: transfer.nairaAmount.toFixed(2),
        recipientName: transfer.recipientName || 'Unknown',
        recipientType: transfer.recipientType,
        completedAt: transfer.completedAt?.toISO() || new Date().toISOString(),
        bankReference: transfer.bankTransferRef || 'N/A',
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Transfer Completed ✓ - ${transfer.uniqueId.substring(0, 8)}`,
        template: 'transfer_completed',
        replacements: emailData,
      })

      Logger.info(
        `[EmailNotification] Transfer completed email sent to ${user.email}`
      )
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send transfer completed email: ${error}`
      )
    }
  }

  /**
   * Send transfer failed notification
   */
  async sendTransferFailedEmail(
    transfer: Transfer,
    reason?: string
  ): Promise<void> {
    try {
      const user = await User.findOrFail(transfer.senderUserId)

      const emailData = {
        transferId: transfer.uniqueId,
        usdtAmount: transfer.usdtAmount.toFixed(6),
        nairaAmount: transfer.nairaAmount.toFixed(2),
        recipientName: transfer.recipientName || 'Unknown',
        reason: reason || 'An error occurred during settlement',
        supportUrl: 'https://support.paymentsystem.com',
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Transfer Failed ✗ - ${transfer.uniqueId.substring(0, 8)}`,
        template: 'transfer_failed',
        replacements: emailData,
      })

      Logger.info(`[EmailNotification] Transfer failed email sent to ${user.email}`)
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send transfer failed email: ${error}`
      )
    }
  }

  /**
   * Get estimated settlement time
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
   * Send Fiber payment received notification
   * Called after instant settlement via Fiber protocol
   */
  async sendFiberPaymentReceivedEmail(
    businessId: string,
    paymentId: string,
    paymentHash: string,
    amountCrypto: number,
    currency: string,
    amountUsd: number,
    platformFee: number,
    netAmount: number,
    description?: string,
    dashboardUrl?: string
  ): Promise<void> {
    try {
      const user = await User.query().where('uniqueId', businessId).firstOrFail()

      const emailData = {
        businessName: user.businessName,
        userEmail: user.email,
        paymentId: paymentId,
        paymentHash: paymentHash,
        amountCrypto: amountCrypto.toFixed(8),
        currency: currency,
        amountUsd: amountUsd.toFixed(2),
        platformFee: platformFee.toFixed(2),
        netAmount: netAmount.toFixed(2),
        description: description || 'Fiber Payment',
        receivedAt: new Date().toLocaleString(),
        settlementTime: new Date().toLocaleString(),
        dashboardUrl: dashboardUrl || 'https://dashboard.paymentsystem.com/payments',
        currentYear: new Date().getFullYear(),
      }

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `Instant Payment Received: ${amountUsd.toFixed(2)} USD`,
        template: 'fiber_payment_received',
        replacements: emailData,
      })

      Logger.info(
        `[EmailNotification] Fiber payment email sent to ${user.email}`
      )
    } catch (error) {
      Logger.warn(
        `[EmailNotification] Failed to send Fiber payment email: ${error}`
      )
      // Don't throw - notifications are non-blocking
    }
  }

  /**
   * Send deposit credited email to the user.
   * Called by StablecoinConversionService once funds land in the wallet.
   */
  async sendDepositCreditedEmail(
    user: any,
    data: {
      currencySymbol: string
      nairaAmount: number
      creditedAmount: number
      newBalance: number
      creditedAt: Date
    }
  ): Promise<void> {
    try {
      const creditedAtStr = data.creditedAt.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'medium',
        timeStyle: 'short',
      })

      await this.notificationService.sendEmail({
        to: user.email,
        subject: `₦${data.nairaAmount.toLocaleString()} converted to ${data.creditedAmount} ${data.currencySymbol}`,
        template: 'payment_received',
        replacements: {
          name: user.firstName || user.businessName || 'User',
          amount: `${data.creditedAmount} ${data.currencySymbol}`,
          naira_amount: `₦${data.nairaAmount.toLocaleString()}`,
          currency: data.currencySymbol,
          new_balance: `${data.newBalance} ${data.currencySymbol}`,
          credited_at: creditedAtStr,
          message: `Your naira deposit has been converted and credited to your ${data.currencySymbol} wallet.`,
        },
      })
    } catch (err) {
      Logger.warn(`[EmailNotification] Failed to send deposit credited email: ${err}`)
    }
  }

  /**
   * Get blockchain explorer URL based on network
   */
  private getExplorerUrl(
    txHash: string,
    _paymentIntent: PaymentIntent
  ): string {
    // Map network chain keys to explorer URLs
    const explorers: Record<string, string> = {
      BSC: `https://bscscan.com/tx/${txHash}`,
      ETHEREUM: `https://etherscan.io/tx/${txHash}`,
      SEPOLIA: `https://sepolia.etherscan.io/tx/${txHash}`,
      BASE: `https://basescan.org/tx/${txHash}`,
      BASE_SEPOLIA: `https://sepolia.basescan.org/tx/${txHash}`,
      ASSETCHAIN_TESTNET: `https://explorer-testnet.assetchain.org/tx/${txHash}`,
      LOCAL: `http://localhost:8545/tx/${txHash}`, // For local testing
    }

    // Default to a generic URL if network not found
    return explorers['ETHEREUM'] || `https://etherscan.io/tx/${txHash}`
  }
}

export default new EmailNotificationService()

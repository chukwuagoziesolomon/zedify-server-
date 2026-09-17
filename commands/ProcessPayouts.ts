import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'
import BusinessSetting from 'App/Models/BusinessSetting'
import UserWallet from 'App/Models/UserWallet'
import PayoutService from 'App/Services/PayoutService'
import User from 'App/Models/User'
import ConversionService from 'App/Services/ConversionService'
import { getPlatformFeePercentage } from 'App/helpers/utils'
import WhatsAppNotificationService from 'App/Services/WhatsAppNotificationService'
import { DateTime } from 'luxon'

export default class ProcessPayoutsCommand extends BaseCommand {
  public static commandName = 'process:payouts'
  public static description = 'Process scheduled auto-settlements for businesses'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Dry run — do not execute transfers' })
  public declare dryRun: boolean

  public async run(): Promise<void> {
    const now = DateTime.now()
    const currentTime = now.toFormat('HH:mm')

    Logger.info(`[ProcessPayouts] Starting auto-settlement run at ${now.toISO()}`)

    const settings = await BusinessSetting.query()
      .where('auto_settlement_enabled', true)
      .where('auto_settlement_time', '<=', currentTime)

    Logger.info(`[ProcessPayouts] Found ${settings.length} businesses due for settlement`)

    let processed = 0
    let failed = 0
    let skipped = 0

    for (const setting of settings) {
      try {
        const lastPayoutAt = setting.lastPayoutAt
        const intervalHours = this.getIntervalHours(setting.payoutInterval)
        const nextPayoutAt = lastPayoutAt ? lastPayoutAt.plus({ hours: intervalHours }) : now.minus({ hours: intervalHours })

        if (now < nextPayoutAt) {
          skipped++
          continue
        }

        const user = await User.query().where('uniqueId', setting.businessId).first()
        if (!user) {
          Logger.warn(`[ProcessPayouts] User not found for business ${setting.businessId}`)
          skipped++
          continue
        }

        const wallets = await UserWallet.query()
          .where('userId', user.id)
          .where('status', 'active')
          .where('balance', '>', 0)

        if (wallets.length === 0) {
          Logger.info(`[ProcessPayouts] No active wallets with balance for business ${setting.businessId}`)
          skipped++
          continue
        }

        const totalBalanceUsd = wallets.reduce((sum, w) => sum + Number(w.balance), 0)
        if (totalBalanceUsd <= 0) {
          skipped++
          continue
        }

        if (this.dryRun) {
          Logger.info(`[ProcessPayouts] [DRY RUN] Would payout ${totalBalanceUsd.toFixed(6)} USDT for business ${setting.businessId}`)
          processed++
          continue
        }

        if (setting.payoutMethod === 'bank') {
          await this.processBankPayout(setting, user, wallets, totalBalanceUsd)
        } else {
          await this.processWalletPayout(setting, wallets)
        }

        setting.lastPayoutAt = now
        setting.lastPayoutStatus = 'completed'
        await setting.save()

        Logger.info(`[ProcessPayouts] Successfully processed payout for business ${setting.businessId}: ${totalBalanceUsd.toFixed(6)} USDT`)
        processed++
      } catch (error) {
        Logger.error(`[ProcessPayouts] Failed to process payout for business ${setting.businessId}: ${error.message}`)
        failed++
        try {
          setting.lastPayoutStatus = 'failed'
          await setting.save()
        } catch {}
      }
    }

    Logger.info(`[ProcessPayouts] Completed: ${processed} processed, ${failed} failed, ${skipped} skipped`)
  }

  private async processBankPayout(setting: BusinessSetting, user: User, wallets: UserWallet[], totalUsd: number): Promise<void> {
    const nairaAmount = await this.convertUsdToNaira(totalUsd)
    if (!nairaAmount || nairaAmount <= 0) {
      throw new Error('Could not calculate Naira equivalent')
    }

    if (!setting.payoutBankAccountNo || !setting.payoutBankCode) {
      throw new Error('Bank account details not configured')
    }

    const totalWalletsBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0)
    for (const wallet of wallets) {
      const share = totalWalletsBalance > 0 ? (Number(wallet.balance) / totalWalletsBalance) * totalUsd : 0
      wallet.balance = parseFloat((Number(wallet.balance) - share).toFixed(6))
      wallet.totalWithdrawn = parseFloat((Number(wallet.totalWithdrawn) + share).toFixed(6))
      await wallet.save()
    }

    const payoutResult = await PayoutService.payoutToBank({
      transferId: `auto_${Date.now()}`,
      nairaAmount,
      recipient: {
        type: 'bank_account',
        bankAccount: {
          accountNumber: setting.payoutBankAccountNo,
          bankCode: setting.payoutBankCode,
          accountName: setting.payoutAccountName || undefined,
        },
      },
    })

    await this.sendAutoSettlementEmail(user, totalUsd, nairaAmount, 'bank')
    await this.sendAutoSettlementWhatsApp(user, totalUsd, nairaAmount, setting.payoutBankAccountNo, payoutResult)
  }

  private async processWalletPayout(setting: BusinessSetting, wallets: UserWallet[]): Promise<void> {
    const destinationWallet = setting.payoutWalletId
      ? wallets.find((w) => w.uniqueId === setting.payoutWalletId)
      : null

    const destinationAddress = destinationWallet?.walletAddress || wallets[0]?.walletAddress
    if (!destinationAddress) {
      throw new Error('No destination wallet address configured')
    }

    const totalUsd = wallets
      .filter((w) => !destinationWallet || w.uniqueId !== destinationWallet.uniqueId)
      .reduce((sum, w) => sum + Number(w.balance), 0)

    const withdrawalService = (await import('App/Services/WithdrawalService')).default
    const userId = wallets[0].userId.toString()

    for (const wallet of wallets) {
      if (destinationWallet && wallet.uniqueId === destinationWallet.uniqueId) {
        continue
      }

      if (Number(wallet.balance) <= 0) {
        continue
      }

      const result = await withdrawalService.processAutoSettlementWithdrawal(userId, {
        type: 'crypto',
        userWalletId: wallet.uniqueId,
        cryptoCurrencyId: wallet.currencyId,
        networkId: wallet.cryptoNetworkId,
        amount: Number(wallet.balance),
        recipientAddress: destinationAddress,
      })

      Logger.info(`[ProcessPayouts] Sent ${wallet.balance} from wallet ${wallet.uniqueId}: txRef=${(result as any).transactionId}`)
    }

    const user = await User.query().where('id', wallets[0].userId).first()
    if (user) {
      await this.sendAutoSettlementEmail(user, totalUsd, 0, 'wallet')
    }
  }

  private async sendAutoSettlementEmail(user: User, totalUsd: number, nairaAmount: number, method: 'bank' | 'wallet'): Promise<void> {
    try {
      const { NotificationService } = await import('App/Lib/notification/notification')
      const notificationService = new NotificationService()
      const now = DateTime.now().toFormat('dd MMM yyyy, HH:mm')

      await notificationService.sendEmail({
        to: user.email,
        subject: 'Auto-Settlement Processed',
        template: 'auto_settlement_completed',
        replacements: {
          businessName: user.businessName || user.email,
          amount: totalUsd.toFixed(2),
          method: method === 'bank' ? 'Bank Transfer (NGN)' : 'Crypto Wallet',
          nairaAmount: method === 'bank' ? nairaAmount.toLocaleString() : null,
          completedAt: now,
          year: new Date().getFullYear(),
        },
      })
    } catch (emailErr: any) {
      Logger.warn(`[ProcessPayouts] Auto-settlement email failed: ${emailErr.message}`)
    }
  }

  private async sendAutoSettlementWhatsApp(
    user: User,
    totalUsd: number,
    nairaAmount: number,
    accountNumber: string | null,
    payoutResult: { success: boolean; payoutId: string; message: string }
  ): Promise<void> {
    try {
      if (!user.phone) return

      const maskedAccount = accountNumber
        ? `****${accountNumber.slice(-4)}`
        : 'your bank account'

      const message = `Your auto-settlement of ${totalUsd.toFixed(2)} USDT has been processed. You received ₦${nairaAmount.toLocaleString()} in ${maskedAccount}. Status: ${payoutResult.success ? 'Successful' : 'Processing'}. Ref: ${payoutResult.payoutId}`

      await WhatsAppNotificationService.sendMessage(user.phone, message)
    } catch (whatsappErr: any) {
      Logger.warn(`[ProcessPayouts] Auto-settlement WhatsApp failed: ${whatsappErr.message}`)
    }
  }

  private async convertUsdToNaira(usdAmount: number): Promise<number | null> {
    try {
      const rawRate = await ConversionService.getCurrentExchangeRate()
      const platformFeePercentage = await getPlatformFeePercentage()

      const effectiveRate = platformFeePercentage > 0
        ? parseFloat((rawRate * (1 - platformFeePercentage / 100)).toFixed(2))
        : rawRate

      const nairaAmount = usdAmount * effectiveRate
      Logger.info(`[ProcessPayouts] Converted ${usdAmount} USDT to ${nairaAmount.toFixed(2)} NGN (rate: 1 USDT = ${effectiveRate} NGN, platformFee: ${platformFeePercentage}%)`)
      return parseFloat(nairaAmount.toFixed(2))
    } catch (error) {
      Logger.error(`[ProcessPayouts] Conversion failed: ${error.message}`)
      return null
    }
  }

  private getIntervalHours(interval: string): number {
    switch (interval) {
      case 'DAILY':
        return 24
      case 'WEEKLY':
        return 168
      case 'INSTANT':
      default:
        return 24
    }
  }
}
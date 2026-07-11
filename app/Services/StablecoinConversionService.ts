import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime as LuxonDateTime } from 'luxon'
import FiatDeposit from 'App/Models/FiatDeposit'
import UserWallet from 'App/Models/UserWallet'
import Currency from 'App/Models/Currency'
import User from 'App/Models/User'
import Shop from 'App/Models/Shop'
import SseService from './SseService'
import EmailNotificationService from './EmailNotificationService'

/**
 * StablecoinConversionService
 *
 * Handles the pipeline: fiat received → convert to stablecoin → credit user wallet.
 *
 * Step 1: handleFiatReceived(depositUniqueId)
 *   — Called by the Paystack webhook once charge.success fires.
 *   — Marks deposit as fiat_received and kicks off conversion.
 *
 * Step 2: convertAndCredit(deposit)
 *   — Routes to Fiber (for CKB-rail stablecoins like RUSD) or EVM on-ramp
 *     (for USDT/USDC on EVM chains). Both paths are stubbed with a simple
 *     rate-based conversion — plug your real liquidity provider here.
 *
 * Step 3: creditWallet(deposit, currency, amount)
 *   — Atomically credits the user's UserWallet balance, then notifies via
 *     SSE and email.
 *   — If the deposit is linked to a shop customization unlock, the shop is
 *     marked as paid so the user can access the AI shop builder.
 */
class StablecoinConversionService {
  /**
   * Entry point called by the Paystack webhook handler.
   */
  async handleFiatReceived(depositUniqueId: string): Promise<void> {
    const deposit = await FiatDeposit.query().where('uniqueId', depositUniqueId).firstOrFail()

    if (deposit.status !== 'pending') {
      Logger.warn(
        `[StablecoinConversion] Deposit ${depositUniqueId} not pending (status=${deposit.status}), skipping`
      )
      return
    }

    deposit.status = 'fiat_received'
    deposit.fiatReceivedAt = DateTime.now()
    await deposit.save()

    await this.convertAndCredit(deposit)
  }

  private async convertAndCredit(deposit: FiatDeposit): Promise<void> {
    try {
      deposit.status = 'converting'
      await deposit.save()

      const currency = await Currency.query()
        .where('id', deposit.targetCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail()

      const network = (currency as any).cryptoNetwork
      const isFiberRail = String(network?.networkType).toLowerCase() === 'ckb'

      let convertedAmount: number
      let exchangeRate: number

      if (isFiberRail) {
        // RUSD path — Fiber/CKB rail.
        // TODO: replace stub with real FiberService liquidity call.
        ;({ convertedAmount, exchangeRate } = await this.convertViaFiber(deposit.nairaAmount, currency))
      } else {
        // USDT/USDC path — EVM on-ramp.
        // TODO: replace stub with real provider call (Yellow Card, Quidax, etc.)
        ;({ convertedAmount, exchangeRate } = await this.convertViaEvmOnRamp(deposit.nairaAmount, currency))
      }

      deposit.exchangeRate = exchangeRate
      deposit.convertedAmount = convertedAmount
      await deposit.save()

      await this.creditWallet(deposit, currency, convertedAmount)
    } catch (error: any) {
      deposit.status = 'failed'
      deposit.failureReason = String(error?.message ?? error)
      await deposit.save()
      Logger.error(
        `[StablecoinConversion] Conversion failed for deposit ${deposit.uniqueId}: ${error}`
      )
      // NOTE: NGN was already collected at this point.
      // A refund / retry path needs to be wired before going live with real funds.
    }
  }

  /** Stub: RUSD via Fiber/CKB rail. Replace with real FiberService swap call. */
  private async convertViaFiber(
    nairaAmount: number,
    currency: Currency
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    const exchangeRate = Number(currency.ratePerUsd)
    const convertedAmount = Number((nairaAmount / exchangeRate).toFixed(8))
    Logger.info(
      `[StablecoinConversion] (stub) Fiber: ${nairaAmount} NGN → ${convertedAmount} ${currency.symbol}`
    )
    return { convertedAmount, exchangeRate }
  }

  /** Stub: USDT/USDC via EVM on-ramp partner. Replace with real API call. */
  private async convertViaEvmOnRamp(
    nairaAmount: number,
    currency: Currency
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    const exchangeRate = Number(currency.ratePerUsd)
    const convertedAmount = Number((nairaAmount / exchangeRate).toFixed(8))
    Logger.info(
      `[StablecoinConversion] (stub) EVM on-ramp: ${nairaAmount} NGN → ${convertedAmount} ${currency.symbol}`
    )
    return { convertedAmount, exchangeRate }
  }

  /**
   * Atomically credit the user's wallet, then notify via SSE + email.
   * If this deposit is linked to a shop AI-customization unlock,
   * the shop is marked as paid after the wallet is credited.
   */
  private async creditWallet(
    deposit: FiatDeposit,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const trx = await Database.transaction()

    try {
      // Row-level lock prevents a race if two deposits credit the same wallet concurrently
      let wallet = await UserWallet.query({ client: trx })
        .where('userId', deposit.userId)
        .where('currencyId', String(currency.id))
        .forUpdate()
        .first()

      if (!wallet) {
        wallet = new UserWallet()
        wallet.userId = String(deposit.userId)
        wallet.currencyId = String(currency.id)
        wallet.balance = 0
        wallet.status = 'active'
        wallet.useTransaction(trx)
      } else {
        wallet.useTransaction(trx)
      }

      wallet.balance = Number(wallet.balance) + amount
      await wallet.save()

      deposit.status = 'credited'
      deposit.creditedAt = LuxonDateTime.now()
      deposit.useTransaction(trx)
      await deposit.save()

      await trx.commit()

      Logger.info(
        `[StablecoinConversion] Credited ${amount} ${currency.symbol} to user ${deposit.userId}`
      )

      // Unlock AI-customization if this deposit was for a shop upgrade
      await this.unlockShopCustomizationIfLinked(deposit)

      await this.notifyUser(deposit, currency, amount, wallet.balance)
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * If this deposit was linked to a shop AI-customization unlock, mark the shop as paid.
   */
  private async unlockShopCustomizationIfLinked(deposit: FiatDeposit): Promise<void> {
    if (!deposit.shopCustomizationId) return

    try {
      const shop = await Shop.query().where('uniqueId', deposit.shopCustomizationId).first()
      if (!shop || shop.customizationAccessPaid) return

      shop.customizationAccessPaid = true
      shop.customizationAccessPaidAt = LuxonDateTime.now()
      await shop.save()

      Logger.info(
        `[StablecoinConversion] Unlocked AI customization for shop ${shop.uniqueId}`
      )

      // Push SSE notification for the unlock
      SseService.emit(String(deposit.userId), {
        event: 'shop.customization_unlocked',
        data: {
          shop_id: shop.uniqueId,
          shop_name: shop.businessName,
          unlocked_at: shop.customizationAccessPaidAt?.toISO(),
        },
      })
    } catch (err) {
      Logger.warn(
        `[StablecoinConversion] Failed to unlock shop customization for deposit ${deposit.uniqueId}: ${err}`
      )
    }
  }

  /**
   * SSE + email notification once funds are credited.
   */
  private async notifyUser(
    deposit: FiatDeposit,
    currency: Currency,
    creditedAmount: number,
    newBalance: number
  ): Promise<void> {
    try {
      SseService.emit(String(deposit.userId), {
        event: 'wallet.deposit_credited',
        data: {
          deposit_id: deposit.uniqueId,
          currency: currency.symbol,
          credited_amount: creditedAmount,
          new_balance: newBalance,
          naira_amount: deposit.nairaAmount,
          exchange_rate: deposit.exchangeRate,
        },
      })

      const user = await User.find(deposit.userId)
      if (user) {
        await EmailNotificationService.sendDepositCreditedEmail(user, {
          currencySymbol: currency.symbol,
          nairaAmount: deposit.nairaAmount,
          creditedAmount,
          newBalance,
          creditedAt: deposit.creditedAt?.toJSDate() ?? new Date(),
        })
      }
    } catch (err) {
      Logger.warn(
        `[StablecoinConversion] Notification failed for deposit ${deposit.uniqueId}: ${err}`
      )
      // Funds are already credited — don't fail the deposit over a notification error
    }
  }
}

export default new StablecoinConversionService()

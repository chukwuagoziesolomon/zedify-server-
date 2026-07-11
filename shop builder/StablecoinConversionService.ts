import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import FiatDeposit from 'App/Models/FiatDeposit'
import UserWallet from 'App/Models/UserWallet'
import Currency from 'App/Models/Currency'
import User from 'App/Models/User'
import SseService from './SseService'
import EmailNotificationService from './EmailNotificationService'
// import FiberService from './FiberService'   // already exists — used for RUSD path
// import EVMService from './EVMService'       // already exists — used for USDT/USDC path

class StablecoinConversionService {
  /**
   * Step 1 — called once your fiat provider (Paystack) confirms the NGN charge succeeded.
   * Marks the deposit as fiat_received and kicks off conversion.
   */
  async handleFiatReceived(depositUniqueId: string): Promise<void> {
    const deposit = await FiatDeposit.query().where('uniqueId', depositUniqueId).firstOrFail()

    if (deposit.status !== 'pending') {
      Logger.warn(`[StablecoinConversion] Deposit ${depositUniqueId} not pending (status=${deposit.status}), skipping`)
      return
    }

    deposit.status = 'fiat_received'
    deposit.fiatReceivedAt = DateTime.now()
    await deposit.save()

    await this.convertAndCredit(deposit)
  }

  /**
   * Step 2 — routes the conversion based on which chain the target stablecoin lives on,
   * same branching shape as PaymentIndexerService.isFiberInvoiceNetwork().
   */
  private async convertAndCredit(deposit: FiatDeposit): Promise<void> {
    try {
      deposit.status = 'converting'
      await deposit.save()

      const currency = await Currency.query()
        .where('id', deposit.targetCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail()

      const network = currency.cryptoNetwork
      const isFiberRail = String(network?.networkType).toLowerCase() === 'ckb'

      let convertedAmount: number
      let exchangeRate: number

      if (isFiberRail) {
        // RUSD path — buy/route via Fiber. Plug into your existing FiberService here.
        // TODO: replace with the real liquidity call once your RUSD acquisition
        // path is decided (DEX swap, market-maker partner, or CKB sponsorship pool).
        ;({ convertedAmount, exchangeRate } = await this.convertViaFiber(deposit.nairaAmount, currency))
      } else {
        // USDT/USDC path — buy via your EVM on-ramp/liquidity partner.
        // TODO: replace with the real provider call (Yellow Card, Quidax, etc.)
        ;({ convertedAmount, exchangeRate } = await this.convertViaEvmOnRamp(deposit.nairaAmount, currency))
      }

      deposit.exchangeRate = exchangeRate
      deposit.convertedAmount = convertedAmount
      await deposit.save()

      await this.creditWallet(deposit, currency, convertedAmount)
    } catch (error) {
      deposit.status = 'failed'
      deposit.failureReason = String(error?.message ?? error)
      await deposit.save()
      Logger.error(`[StablecoinConversion] Conversion failed for deposit ${deposit.uniqueId}: ${error}`)
      // Note: NGN was already collected — a failed conversion needs a refund or retry
      // path, not just a status flip. Wire that up before this goes live with real funds.
    }
  }

  /** RUSD acquisition via Fiber/CKB. Stub — wire to FiberService once the liquidity source is chosen. */
  private async convertViaFiber(
    nairaAmount: number,
    currency: Currency
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    // Placeholder: 1 RUSD ≈ $1, using currency.ratePerUsd (NGN per USD) as the bridge rate.
    const exchangeRate = currency.ratePerUsd
    const convertedAmount = Number((nairaAmount / exchangeRate).toFixed(8))
    Logger.info(`[StablecoinConversion] (stub) Would route ${nairaAmount} NGN -> ${convertedAmount} ${currency.symbol} via Fiber`)
    return { convertedAmount, exchangeRate }
  }

  /** USDT/USDC acquisition via an EVM on-ramp partner. Stub — wire to your chosen provider's API. */
  private async convertViaEvmOnRamp(
    nairaAmount: number,
    currency: Currency
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    const exchangeRate = currency.ratePerUsd
    const convertedAmount = Number((nairaAmount / exchangeRate).toFixed(8))
    Logger.info(`[StablecoinConversion] (stub) Would route ${nairaAmount} NGN -> ${convertedAmount} ${currency.symbol} via EVM on-ramp`)
    return { convertedAmount, exchangeRate }
  }

  /**
   * Step 3 — credit the user's per-currency wallet balance, atomically, then notify.
   * Mirrors PaymentIndexerService.onPaymentConfirmed's transaction + notify pattern.
   */
  private async creditWallet(deposit: FiatDeposit, currency: Currency, amount: number): Promise<void> {
    const trx = await Database.transaction()

    try {
      // row-level lock prevents a race if two deposits credit the same wallet concurrently
      let wallet = await UserWallet.query({ client: trx })
        .where('userId', deposit.userId)
        .where('currencyId', currency.id)
        .forUpdate()
        .first()

      if (!wallet) {
        wallet = new UserWallet()
        wallet.userId = deposit.userId
        wallet.currencyId = currency.id
        wallet.balance = 0
        wallet.status = 'active'
        wallet.useTransaction(trx)
      } else {
        wallet.useTransaction(trx)
      }

      wallet.balance = Number(wallet.balance) + amount
      await wallet.save()

      deposit.status = 'credited'
      deposit.creditedAt = DateTime.now()
      deposit.useTransaction(trx)
      await deposit.save()

      await trx.commit()

      Logger.info(`[StablecoinConversion] Credited ${amount} ${currency.symbol} to user ${deposit.userId}`)

      await this.notifyUser(deposit, currency, amount, wallet.balance)
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /** Real-time + email notification once funds land — reuses your existing SSE/email services. */
  private async notifyUser(
    deposit: FiatDeposit,
    currency: Currency,
    creditedAmount: number,
    newBalance: number
  ): Promise<void> {
    try {
      SseService.emit(deposit.userId, {
        event: 'wallet.deposit_credited',
        data: {
          depositId: deposit.uniqueId,
          currency: currency.symbol,
          creditedAmount,
          newBalance,
          nairaAmount: deposit.nairaAmount,
          exchangeRate: deposit.exchangeRate,
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
      Logger.warn(`[StablecoinConversion] Notification failed for deposit ${deposit.uniqueId}: ${err}`)
      // don't fail the deposit over a notification error — funds are already credited
    }
  }
}

export default new StablecoinConversionService()

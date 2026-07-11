import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { v4 as uuidv4 } from 'uuid'
import FiatDeposit from 'App/Models/FiatDeposit'
import Currency from 'App/Models/Currency'
import UserWallet from 'App/Models/UserWallet'
import PaystackService from 'App/Services/PaystackService'

export default class WalletController {
  /**
   * GET /api/currencies/stablecoins
   * Powers the currency-selection/disclosure screen — RUSD / USDT / USDC
   * shown side by side with their peg issuer and backing info, never
   * presented as interchangeable.
   */
  public async listStablecoins({ response }: HttpContextContract) {
    const currencies = await Currency.query()
      .where('isStablecoin', true)
      .preload('cryptoNetwork')

    return response.ok({
      currencies: currencies.map((c) => ({
        id: c.uniqueId,
        symbol: c.symbol,
        network: c.cryptoNetwork?.name,
        pegTarget: c.pegTarget,
        peggedBy: c.peggedBy,
        backingInfo: c.backingInfo,
      })),
    })
  }

  /**
   * GET /api/wallet/balances
   * Returns the authenticated user's balance across every stablecoin they hold.
   */
  public async balances({ auth, response }: HttpContextContract) {
    const wallets = await UserWallet.query()
      .where('userId', auth.user!.id)
      .where('status', 'active')
      .preload('currency')

    return response.ok({
      wallets: wallets.map((w) => ({
        currency: w.currency.symbol,
        balance: Number(w.balance),
        pegTarget: w.currency.pegTarget,
      })),
    })
  }

  /**
   * POST /api/wallet/deposit
   * body: { amountNaira: number, currencyId: string }
   * Starts a Paystack charge; the actual conversion + crediting happens
   * once the webhook confirms payment (see PaystackWebhookController).
   */
  public async deposit({ auth, request, response }: HttpContextContract) {
    const { amountNaira, currencyId } = request.only(['amountNaira', 'currencyId'])

    if (!amountNaira || amountNaira <= 0) {
      return response.badRequest({ error: 'amountNaira must be greater than 0' })
    }

    const currency = await Currency.query().where('uniqueId', currencyId).where('isStablecoin', true).first()
    if (!currency) {
      return response.badRequest({ error: 'Unknown or non-stablecoin currencyId' })
    }

    const reference = `dep_${uuidv4()}`

    const deposit = new FiatDeposit()
    deposit.userId = auth.user!.id
    deposit.targetCurrencyId = currency.id
    deposit.nairaAmount = amountNaira
    deposit.provider = 'paystack'
    deposit.providerReference = reference
    deposit.status = 'pending'
    await deposit.save()

    const charge = await PaystackService.initializeCharge({
      email: auth.user!.email,
      amountNaira,
      reference,
      metadata: { depositUniqueId: deposit.uniqueId, currencySymbol: currency.symbol },
    })

    return response.ok({
      depositId: deposit.uniqueId,
      checkoutUrl: charge.authorizationUrl,
    })
  }

  /**
   * GET /api/wallet/deposits/:id
   * Lets the frontend poll a deposit's status while waiting on the webhook,
   * as a fallback alongside the SSE 'wallet.deposit_credited' event.
   */
  public async depositStatus({ auth, params, response }: HttpContextContract) {
    const deposit = await FiatDeposit.query()
      .where('uniqueId', params.id)
      .where('userId', auth.user!.id)
      .preload('targetCurrency')
      .firstOrFail()

    return response.ok({
      status: deposit.status,
      nairaAmount: deposit.nairaAmount,
      convertedAmount: deposit.convertedAmount,
      currency: deposit.targetCurrency.symbol,
      failureReason: deposit.failureReason,
    })
  }
}

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { DateTime } from 'luxon'
import { resolvePreferredCryptoCurrency } from 'App/helpers/cryptoCurrencySelection'
import PaymentSetupService from 'App/Services/PaymentSetupService'
import Wallet from 'App/Models/Wallet'
import PaymentLink from 'App/Models/PaymentLink'
import PaymentIntent from 'App/Models/PaymentIntent'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import { formatSuccessMessage, formatErrorMessage, genRandomUuid, genPaymentLinkSlug } from 'App/helpers/utils'
import { PaymentIntentStatus, PaymentLinkStatus, CurrencyType } from 'App/Lib/types'
import RolesController from './RolesController'
import BusinessCurrencyController from './BusinessCurrencyController'
import CurrencyController from './CurrencyController'

export default class PaymentLinkController extends RolesController {
  // ─── Merchant endpoints (auth required) ───────────────────────────────────

  /** POST /api/client/payment-links */
  public async create({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const body = request.only([
        'title', 'description', 'fiat_currency', 'fiat_amount',
        'is_single_use', 'usage_limit', 'expires_at',
      ])

      // Validate title
      if (!body.title || !String(body.title).trim()) {
        throw new Error('title is required')
      }

      // Resolve fiat currency if provided
      let fiatCurrencyId: string | null = null
      if (body.fiat_currency) {
        const fiatCurrency = await Currency.query().where('symbol', body.fiat_currency).first()
        if (!fiatCurrency) throw new Error(`Unsupported fiat currency: ${body.fiat_currency}`)
        fiatCurrencyId = fiatCurrency.uniqueId
      }

      // Ensure fiat_amount requires a fiat_currency
      if (body.fiat_amount != null && !fiatCurrencyId) {
        throw new Error('fiat_currency is required when fiat_amount is provided')
      }

      // Generate a unique slug
      let slug = genPaymentLinkSlug()
      while (await PaymentLink.query().where('slug', slug).first()) {
        slug = genPaymentLinkSlug()
      }

      const link = await PaymentLink.create({
        uniqueId: genRandomUuid(),
        businessId: userId,
        slug,
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        fiatCurrencyId,
        fiatAmount: body.fiat_amount != null ? Number(body.fiat_amount) : null,
        status: PaymentLinkStatus.ACTIVE,
        isSingleUse: body.is_single_use === true || body.is_single_use === 'true',
        usageCount: 0,
        usageLimit: body.usage_limit != null ? Number(body.usage_limit) : null,
        expiresAt: body.expires_at ? DateTime.fromISO(body.expires_at) : null,
      })

      return response.created(formatSuccessMessage('Payment link created', {
        link: this.formatLink(link),
        checkout_url: `/api/pay/${link.slug}`,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /** GET /api/client/payment-links */
  public async list({ response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const links = await PaymentLink.query()
        .where('businessId', userId)
        .orderBy('createdAt', 'desc')

      return response.ok(formatSuccessMessage('Payment links fetched', {
        links: links.map((l) => this.formatLink(l)),
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /** GET /api/client/payment-links/:id */
  public async show({ params, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const link = await PaymentLink.query()
        .where('uniqueId', params.id)
        .andWhere('businessId', userId)
        .first()

      if (!link) throw new Error('Payment link not found')

      return response.ok(formatSuccessMessage('Payment link fetched', {
        link: this.formatLink(link),
        checkout_url: `/api/pay/${link.slug}`,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /** PATCH /api/client/payment-links/:id */
  public async update({ params, request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const link = await PaymentLink.query()
        .where('uniqueId', params.id)
        .andWhere('businessId', userId)
        .first()

      if (!link) throw new Error('Payment link not found')

      const body = request.only([
        'title', 'description', 'fiat_amount', 'status',
        'is_single_use', 'usage_limit', 'expires_at',
      ])

      if (body.title != null) link.title = String(body.title).trim()
      if (body.description != null) link.description = String(body.description).trim()
      if (body.fiat_amount != null) link.fiatAmount = Number(body.fiat_amount)
      if (body.status != null) {
        if (!['active', 'inactive'].includes(body.status)) {
          throw new Error('status must be one of: active, inactive')
        }
        link.status = body.status as PaymentLinkStatus
      }
      if (body.is_single_use != null) {
        link.isSingleUse = body.is_single_use === true || body.is_single_use === 'true'
      }
      if (body.usage_limit != null) link.usageLimit = Number(body.usage_limit)
      if (body.expires_at != null) link.expiresAt = DateTime.fromISO(body.expires_at)

      await link.save()

      return response.ok(formatSuccessMessage('Payment link updated', {
        link: this.formatLink(link),
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /** DELETE /api/client/payment-links/:id */
  public async destroy({ params, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const link = await PaymentLink.query()
        .where('uniqueId', params.id)
        .andWhere('businessId', userId)
        .first()

      if (!link) throw new Error('Payment link not found')

      await link.delete()

      return response.ok(formatSuccessMessage('Payment link deleted', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // ─── Public checkout endpoints (no auth) ──────────────────────────────────

  /**
   * GET /api/pay/:slug
   * Returns link details + available currencies for the merchant.
   * Used by the payment widget to render the checkout page.
   */
  public async publicShow({ params, response }: HttpContextContract) {
    try {
      const link = await PaymentLink.query().where('slug', params.slug).first()
      if (!link) throw new Error('Payment link not found')

      if (!link.isActive()) {
        return response.status(410).json({
          error: true,
          message: 'This payment link is no longer active',
        })
      }

      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(link.businessId)

      const assets = await Promise.all(
        activeCurrencies.map(async (bc) => {
          const currency = await Currency.query().where('uniqueId', bc.uniqueId).first()
          let network: { name: string; logo: string } | null = null
          let amount: number | null = null

          if (currency && currency.type === CurrencyType.CRYPTO) {
            const cryptoNetwork = await CryptoNetwork.query().where('uniqueId', currency.cryptoNetworkId).first()
            if (cryptoNetwork) {
              network = { name: cryptoNetwork.name, logo: cryptoNetwork.logo }
            }

            if (link.fiatCurrencyId && link.fiatAmount != null) {
              amount = await CurrencyController.calculateCryptoEquivalent({
                fiatCurrencyId: link.fiatCurrencyId,
                fiatAmount: link.fiatAmount,
                cryptoCurrencyId: currency.uniqueId,
              })
            }
          }

          return {
            currency_id: currency?.uniqueId || '',
            name: currency?.name || '',
            symbol: currency?.symbol || '',
            logo: currency?.logo || '',
            network,
            amount,
          }
        })
      )

      // Resolve fiat currency info
      let fiatCurrency: { symbol: string; name: string } | null = null
      if (link.fiatCurrencyId) {
        const fc = await Currency.query().where('uniqueId', link.fiatCurrencyId).first()
        if (fc) fiatCurrency = { symbol: fc.symbol, name: fc.name }
      }

      return response.ok({
        error: false,
        data: {
          slug: link.slug,
          title: link.title,
          description: link.description,
          fiat_amount: link.fiatAmount,
          fiat_currency: fiatCurrency,
          is_fixed_amount: link.fiatAmount != null,
          assets,
        },
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/pay/:slug/checkout
   * Creates a PaymentIntent from a payment link.
   * Body: { fiat_amount? } — required only when the link has no fixed amount.
   * Returns: reference_id + available currencies (same shape as payment-intent create).
   */
  public async checkout({ params, request, response }: HttpContextContract) {
    try {
      const link = await PaymentLink.query().where('slug', params.slug).first()
      if (!link) throw new Error('Payment link not found')

      if (!link.isActive()) {
        return response.status(410).json({
          error: true,
          message: 'This payment link is no longer active',
        })
      }

      // Resolve amount
      let fiatAmount: number
      let fiatCurrencyId: string
      const requestedReferenceId = request.input('reference_id') || request.input('referenceId')

      if (link.fiatAmount != null && link.fiatCurrencyId) {
        fiatAmount = link.fiatAmount
        fiatCurrencyId = link.fiatCurrencyId
      } else {
        const body = request.only(['fiat_amount', 'fiat_currency'])
        if (body.fiat_amount == null) throw new Error('fiat_amount is required for this payment link')
        if (!body.fiat_currency) throw new Error('fiat_currency is required for this payment link')
        fiatAmount = Number(body.fiat_amount)
        if (isNaN(fiatAmount) || fiatAmount <= 0) throw new Error('fiat_amount must be a positive number')
        const fc = await Currency.query().where('symbol', body.fiat_currency).first()
        if (!fc) throw new Error(`Unsupported fiat currency: ${body.fiat_currency}`)
        fiatCurrencyId = fc.uniqueId
      }

      // Use a caller-supplied reference id when provided, otherwise generate one.
      const referenceId = requestedReferenceId
        ? String(requestedReferenceId)
        : `${link.slug}_${Date.now()}`

      // Create the PaymentIntent on behalf of the merchant
      const intent = await PaymentIntent.create({
        uniqueId: genRandomUuid(),
        businessId: link.businessId,
        businessReferenceId: referenceId,
        fiatCurrencyId,
        fiatAmount,
        status: PaymentIntentStatus.PAYMENT_CREATED,
      })

      // Increment usage count
      link.usageCount = (link.usageCount || 0) + 1
      if (link.isSingleUse) link.status = PaymentLinkStatus.INACTIVE
      await link.save()

      // Build assets list
      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(link.businessId)
      const assets = await Promise.all(
        activeCurrencies.map(async (bc) => {
          const currency = await Currency.query().where('uniqueId', bc.uniqueId).first()
          let network: { name: string; logo: string } | null = null
          let amount = 0

          if (currency && currency.type === CurrencyType.CRYPTO) {
            const cryptoNetwork = await CryptoNetwork.query().where('uniqueId', currency.cryptoNetworkId).first()
            if (cryptoNetwork) network = { name: cryptoNetwork.name, logo: cryptoNetwork.logo }
            amount = await CurrencyController.calculateCryptoEquivalent({
              fiatCurrencyId,
              fiatAmount,
              cryptoCurrencyId: currency.uniqueId,
            })
          }

          return {
            currency_id: currency?.uniqueId || '',
            name: currency?.name || '',
            symbol: currency?.symbol || '',
            logo: currency?.logo || '',
            network,
            amount,
          }
        })
      )

      const fiatCurrencyRecord = await Currency.query().where('uniqueId', fiatCurrencyId).first()

      return response.ok(formatSuccessMessage('Checkout session created', {
        payment_intent_id: intent.uniqueId,
        reference_id: referenceId,
        fiat_amount: fiatAmount,
        fiat_currency: fiatCurrencyRecord?.symbol || '',
        assets,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/pay/:slug/wallet
   * Selects a crypto currency for a checkout session and returns a wallet address.
   * Body: { reference_id, crypto_currency_id }
   */
  public async checkoutWallet({ params, request, response }: HttpContextContract) {
    try {
      const link = await PaymentLink.query().where('slug', params.slug).first()
      if (!link) throw new Error('Payment link not found')

      const { reference_id, crypto_currency_id } = request.only(['reference_id', 'crypto_currency_id'])
      if (!reference_id) throw new Error('reference_id is required')
      if (!crypto_currency_id) throw new Error('crypto_currency_id is required')

      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(link.businessId)
      const resolvedCurrencies = (await Promise.all(
        activeCurrencies.map(async (bc) => Currency.query().where('uniqueId', bc.uniqueId).first())
      )).filter((currency): currency is Currency => Boolean(currency))
      const preferredCurrency = resolvePreferredCryptoCurrency(resolvedCurrencies, crypto_currency_id) as Currency | null

      // Find the payment intent
      const intent = await PaymentIntent.query()
        .where('businessReferenceId', reference_id)
        .andWhere('businessId', link.businessId)
        .first()
      if (!intent) throw new Error('Payment session not found')

      // Validate crypto currency
      const cryptoCurrency = preferredCurrency ?? await Currency.query().where('uniqueId', crypto_currency_id).first()
      if (!cryptoCurrency || cryptoCurrency.type !== CurrencyType.CRYPTO) {
        throw new Error('Invalid crypto currency')
      }

      const cryptoNetwork = await CryptoNetwork.query()
        .where('uniqueId', cryptoCurrency.cryptoNetworkId)
        .first()
      if (!cryptoNetwork) throw new Error('Crypto network not found')

      const setup = await PaymentSetupService.createPaymentSetup({
        paymentIntent: intent,
        userUniqueId: link.businessId,
        userIntId: parseInt(link.businessId) || 0,
        cryptoCurrency,
        referenceId: reference_id,
      })

      return response.ok({
        error: false,
        data: {
          reference_id,
          payment_intent_id: intent.uniqueId,
          expiration_time: '1800',
          fee_in_crypto: 0,
          wallet: setup.wallet,
          fiat: setup.fiat,
          crypto: setup.crypto,
        },
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/checkout/status/:referenceId
   * Public order status — no auth required.
   * Returns public-safe checkout details by reference_id.
   */
  public async publicStatus({ params, response }: HttpContextContract) {
    try {
      const referenceId = String(params.referenceId)
      const intent = await PaymentIntent.query()
        .where('businessReferenceId', referenceId)
        .firstOrFail()

      const fiatCurrency = await Currency.query().where('uniqueId', intent.fiatCurrencyId).first()
      const cryptoCurrency = intent.cryptoCurrencyId
        ? await Currency.query().where('uniqueId', intent.cryptoCurrencyId).first()
        : null
      const cryptoNetwork = cryptoCurrency?.cryptoNetworkId
        ? await CryptoNetwork.query().where('uniqueId', cryptoCurrency.cryptoNetworkId).first()
        : null
      const wallet = intent.walletId
        ? await Wallet.query().where('uniqueId', intent.walletId).first()
        : null

      const metadata = intent.metadata || {}
      const itemsTotal = Number(metadata.items_total || 0)
      const deliveryFee = Number(metadata.delivery_fee || 0)
      const discountAmount = Number(metadata.discount_amount || 0)

      return response.ok({
        success: true,
        data: {
          reference_id: intent.businessReferenceId,
          payment_intent_id: intent.uniqueId,
          status: intent.status,
          order_status: metadata.order_status || 'pending',
          fiat_amount: intent.fiatAmount,
          fiat_currency: fiatCurrency?.symbol || null,
          items_count: (metadata.items || []).length,
          items_total: itemsTotal,
          delivery_fee: deliveryFee,
          delivery_fee_currency: metadata.delivery_fee_currency || fiatCurrency?.symbol || null,
          discount_amount: discountAmount,
          total_amount: intent.fiatAmount,
          payment_method: metadata.payment_method || null,
          shop_id: metadata.shop_id || null,
          wallet: wallet
            ? {
                address: wallet.walletAddress,
                network: cryptoNetwork?.name || null,
                currency: cryptoCurrency?.symbol || null,
                amount: intent.feeInCrypto || 0,
              }
            : null,
          expires_at: wallet?.expiresAt?.toISO() || null,
          created_at: intent.createdAt?.toISO() || null,
          paid_at: intent.receivedPaymentAt?.toISO() || null,
          updated_at: intent.updatedAt?.toISO() || null,
        },
      })
    } catch (error) {
      return response.notFound(await formatErrorMessage(error))
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** GET /api/client/payment-links/analytics */
  public async analytics({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const now = DateTime.now()
      const start = request.input('from')
        ? DateTime.fromISO(String(request.input('from'))).startOf('day')
        : now.minus({ days: 30 }).startOf('day')
      const end = request.input('to')
        ? DateTime.fromISO(String(request.input('to'))).endOf('day')
        : now.endOf('day')

      const links = await PaymentLink.query()
        .where('businessId', userId)
        .whereBetween('createdAt', [start.toISO()!, end.toISO()!])
        .orderBy('createdAt', 'desc')

      const linkData = await Promise.all(
        links.map(async (link) => {
          const intents = await PaymentIntent.query()
            .where('businessId', userId)
            .where('businessReferenceId', 'like', `${link.slug}%`)
            .whereBetween('createdAt', [start.toISO()!, end.toISO()!])

          const completed = intents.filter((i) => i.status === PaymentIntentStatus.PAYMENT_COMPLETED)
          const revenue = completed.reduce((sum, i) => sum + Number(i.fiatAmount), 0)

          return {
            id: link.uniqueId,
            slug: link.slug,
            title: link.title,
            usage_count: link.usageCount,
            order_count: completed.length,
            revenue,
            currency: link.fiatCurrencyId,
            is_active: link.isActive(),
            created_at: link.createdAt,
          }
        })
      )

      return response.ok(formatSuccessMessage('Payment link analytics retrieved', {
        from: start.toISO(),
        to: end.toISO(),
        total_clicks: linkData.reduce((sum, link) => sum + link.usage_count, 0),
        total_orders: linkData.reduce((sum, link) => sum + link.order_count, 0),
        total_revenue: linkData.reduce((sum, link) => sum + link.revenue, 0),
        links: linkData,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  private formatLink(link: PaymentLink) {
    return {
      id: link.uniqueId,
      slug: link.slug,
      title: link.title,
      description: link.description,
      fiat_amount: link.fiatAmount,
      fiat_currency_id: link.fiatCurrencyId,
      status: link.status,
      is_single_use: link.isSingleUse,
      usage_count: link.usageCount,
      usage_limit: link.usageLimit,
      expires_at: link.expiresAt?.toISO() ?? null,
      created_at: link.createdAt?.toISO(),
      checkout_url: `/api/pay/${link.slug}`,
    }
  }
}

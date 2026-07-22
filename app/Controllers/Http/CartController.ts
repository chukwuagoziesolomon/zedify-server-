import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import Cart from 'App/Models/Cart'
import CartItem from 'App/Models/CartItem'
import ShopProduct from 'App/Models/ShopProduct'
import Shop from 'App/Models/Shop'
import PaymentIntent from 'App/Models/PaymentIntent'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import BusinessCurrencyController from './BusinessCurrencyController'
import User from 'App/Models/User'
import { genRandomUuid } from 'App/helpers/utils'
import { PaymentIntentStatus, CurrencyType } from 'App/Lib/types'
import SseService from 'App/Services/SseService'
import PaymentSetupService from 'App/Services/PaymentSetupService'

export default class CartController extends RolesController {
  private async emitCartEvent(userId: string, event: string, data: any) {
    SseService.emit(userId, { event: event as any, data })
  }
  /**
   * GET /api/user/cart
   * Returns the authenticated user's cart with items and totals.
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const cart = await Cart.query().where('userId', userId).first()

      if (!cart) {
        return response.ok(formatSuccessMessage('Cart retrieved', { cart: null, items: [], total: 0 }))
      }

      const items = await CartItem.query()
        .where('cartId', cart.uniqueId)
        .preload('product', (productQuery) => {
          productQuery.select('uniqueId', 'shopId', 'name', 'price', 'currency', 'images', 'stock', 'isActive')
        })

      const itemsWithDetails = items.map((item) => {
        const product = item.product as any
        if (!product) return null

        const shop = product.$parent?.shop as any
        const shopData = shop || { uniqueId: product.shopId }

        return {
          id: item.uniqueId,
          product_id: product.uniqueId,
          name: product.name,
          price: product.price,
          currency: product.currency,
          quantity: item.quantity,
          image: product.images?.[0]?.url || null,
          stock: product.stock,
          is_active: product.isActive,
          shop_id: shopData.uniqueId || product.shopId,
        }
      }).filter(Boolean)

      const total = itemsWithDetails.reduce((sum, item: any) => sum + item.price * item.quantity, 0)

      return response.ok(formatSuccessMessage('Cart retrieved', {
        cart_id: cart.uniqueId,
        items: itemsWithDetails,
        total,
        currency: itemsWithDetails[0]?.currency || 'NGN',
        item_count: itemsWithDetails.length,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/cart/items
   * Add a product to the user's cart.
   * Body: { product_id, quantity? }
   */
  public async addItem({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { product_id, quantity = 1 } = request.only(['product_id', 'quantity'])

      if (!product_id) throw new Error('product_id is required.')
      if (quantity < 1) throw new Error('quantity must be at least 1.')

      const product = await ShopProduct.query()
        .where('uniqueId', product_id)
        .where('isActive', true)
        .firstOrFail()

      let cart = await Cart.query().where('userId', userId).first()
      if (!cart) {
        cart = await Cart.create({
          uniqueId: genRandomUuid(),
          userId,
        })
      }

      const existingItem = await CartItem.query()
        .where('cartId', cart.uniqueId)
        .where('productId', product_id)
        .first()

      if (existingItem) {
        existingItem.quantity = Math.min(existingItem.quantity + quantity, product.stock)
        await existingItem.save()
      } else {
        await CartItem.create({
          uniqueId: genRandomUuid(),
          cartId: cart.uniqueId,
          productId: product_id,
          quantity: Math.min(quantity, product.stock),
        })
      }

      await this.emitCartEvent(userId, 'cart.item_added', {
        product_id,
        quantity: Math.min(quantity, product.stock),
        product_name: product.name,
        cart_id: cart.uniqueId,
      })

      return response.ok(formatSuccessMessage('Item added to cart', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /api/user/cart/items/:itemId
   * Update quantity of a cart item.
   * Body: { quantity }
   */
  public async updateItem({ auth, request, response, params }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { quantity } = request.only(['quantity'])

      if (quantity === undefined || quantity === null) throw new Error('quantity is required.')
      if (quantity < 1) throw new Error('quantity must be at least 1.')

      const cart = await Cart.query().where('userId', userId).firstOrFail()
      const item = await CartItem.query()
        .where('uniqueId', params.itemId)
        .where('cartId', cart.uniqueId)
        .firstOrFail()

      const product = await ShopProduct.query().where('uniqueId', item.productId).firstOrFail()
      item.quantity = Math.min(quantity, product.stock)
      await item.save()

      await this.emitCartEvent(userId, 'cart.updated', {
        item_id: item.uniqueId,
        quantity: item.quantity,
        cart_id: cart.uniqueId,
      })

      return response.ok(formatSuccessMessage('Cart item updated', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /api/user/cart/items/:itemId
   * Remove an item from the cart.
   */
  public async removeItem({ auth, response, params }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const cart = await Cart.query().where('userId', userId).firstOrFail()
      const item = await CartItem.query()
        .where('uniqueId', params.itemId)
        .where('cartId', cart.uniqueId)
        .firstOrFail()

      await item.delete()

      await this.emitCartEvent(userId, 'cart.item_removed', {
        item_id: params.itemId,
        cart_id: cart.uniqueId,
      })

      return response.ok(formatSuccessMessage('Item removed from cart', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /api/user/cart
   * Clear all items from the user's cart.
   */
  public async clear({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const cart = await Cart.query().where('userId', userId).first()

      if (cart) {
        await CartItem.query().where('cartId', cart.uniqueId).delete()
      }

      await this.emitCartEvent(userId, 'cart.cleared', {
        cart_id: cart?.uniqueId || null,
      })

      return response.ok(formatSuccessMessage('Cart cleared', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/cart/checkout
   * Create a PaymentIntent from the cart items.
   * Body: { fiat_currency?, payment_method? }
   * payment_method: 'crypto' | 'paystack'
   * Returns: reference_id + available crypto currencies + wallet address or paystack url.
   */
  public async checkout({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { fiat_currency, payment_method = 'crypto' } = request.only(['fiat_currency', 'payment_method'])

      const cart = await Cart.query().where('userId', userId).firstOrFail()
      const items = await CartItem.query()
        .where('cartId', cart.uniqueId)
        .preload('product', (productQuery) => {
          productQuery.select('uniqueId', 'shopId', 'name', 'price', 'currency', 'isActive')
        })

      if (items.length === 0) {
        throw new Error('Your cart is empty.')
      }

      const shopIds = [...new Set(items.map((item) => (item.product as any).shopId))]
      if (shopIds.length > 1) {
        throw new Error('Checkout is limited to one shop at a time. Please clear your cart or checkout with items from a single shop.')
      }

      const shopId = shopIds[0]
      const shop = await Shop.query().where('uniqueId', shopId).firstOrFail()

      const fiatCurrency = fiat_currency || shop.currency || 'NGN'
      const currencyRecord = await Currency.query().where('symbol', fiatCurrency.toUpperCase()).first()
      if (!currencyRecord) throw new Error(`Unsupported fiat currency: ${fiatCurrency}`)

      const fiatAmount = items.reduce((sum, item) => {
        const product = item.product as any
        return sum + product.price * item.quantity
      }, 0)

      if (fiatAmount <= 0) throw new Error('Cart total must be greater than 0.')

      const referenceId = genRandomUuid()
      const customer = await User.query().where('uniqueId', userId).firstOrFail()
      const intent = await PaymentIntent.create({
        uniqueId: genRandomUuid(),
        businessId: shop.userId,
        businessReferenceId: referenceId,
        fiatCurrencyId: currencyRecord.uniqueId,
        fiatAmount,
        status: PaymentIntentStatus.PAYMENT_CREATED,
        customerId: customer.uniqueId,
        customerEmail: customer.email,
      })

      if (payment_method === 'paystack') {
        const PaystackChargeService = (await import('App/Services/PaystackChargeService')).default
        const user = await User.query().where('uniqueId', userId).firstOrFail()
        const charge = await PaystackChargeService.initializeCharge({
          email: user.email,
          amountNaira: fiatAmount,
          reference: referenceId,
          metadata: {
            payment_intent_id: intent.uniqueId,
            shop_id: shop.uniqueId,
            items_count: items.length,
          },
        })

        await this.emitCartEvent(userId, 'cart.checkout_completed', {
          payment_method: 'paystack',
          reference_id: referenceId,
          authorization_url: charge.authorizationUrl,
          fiat_amount: fiatAmount,
          fiat_currency: currencyRecord.symbol,
        })

        return response.ok(formatSuccessMessage('Checkout session created', {
          payment_method: 'paystack',
          payment_intent_id: intent.uniqueId,
          reference_id: referenceId,
          authorization_url: charge.authorizationUrl,
          fiat_amount: fiatAmount,
          fiat_currency: currencyRecord.symbol,
          shop_id: shop.uniqueId,
          items_count: items.length,
        }))
      }

      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(shop.userId)
      const assets = await Promise.all(
        activeCurrencies.map(async (currency) => {
          let network: { name: string; logo: string } | null = null
          let amount = 0

          if (currency.type === CurrencyType.CRYPTO) {
            const cryptoNetwork = currency.cryptoNetwork
            if (cryptoNetwork) network = { name: cryptoNetwork.name, logo: cryptoNetwork.logo }
            amount = fiatAmount
          }

          return {
            currency_id: currency.uniqueId,
            name: currency.name,
            symbol: currency.symbol,
            logo: currency.logo || '',
            network,
            amount,
          }
        })
      )

      await this.emitCartEvent(userId, 'cart.checkout_completed', {
        payment_method: 'crypto',
        reference_id: referenceId,
        fiat_amount: fiatAmount,
        fiat_currency: currencyRecord.symbol,
        assets: assets.length,
      })

      return response.ok(formatSuccessMessage('Checkout session created', {
        payment_intent_id: intent.uniqueId,
        reference_id: referenceId,
        fiat_amount: fiatAmount,
        fiat_currency: currencyRecord.symbol,
        shop_id: shop.uniqueId,
        items_count: items.length,
        assets,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /api/user/cart/wallet
   * Selects a crypto currency for a cart checkout and returns a wallet address.
   * Body: { payment_intent_id, crypto_currency_id }
   */
  public async checkoutWallet({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { payment_intent_id, crypto_currency_id } = request.only(['payment_intent_id', 'crypto_currency_id'])

      if (!payment_intent_id) throw new Error('payment_intent_id is required')
      if (!crypto_currency_id) throw new Error('crypto_currency_id is required')

      const intent = await PaymentIntent.query().where('uniqueId', payment_intent_id).firstOrFail()

      const cryptoCurrency = await Currency.query().where('uniqueId', crypto_currency_id).first()
      if (!cryptoCurrency || cryptoCurrency.type !== CurrencyType.CRYPTO) {
        throw new Error('Invalid crypto currency')
      }

      const cryptoNetwork = await CryptoNetwork.query().where('uniqueId', cryptoCurrency.cryptoNetworkId).first()
      if (!cryptoNetwork) throw new Error('Crypto network not found')

      const user = await User.query().where('uniqueId', userId).firstOrFail()
      const setup = await PaymentSetupService.createPaymentSetup({
        paymentIntent: intent,
        userUniqueId: intent.businessId,
        userIntId: user.id,
        cryptoCurrency,
        referenceId: intent.businessReferenceId,
      })

      return response.ok({
        error: false,
        data: {
          payment_intent_id: intent.uniqueId,
          reference_id: intent.businessReferenceId,
          expiration_time: '1800',
          fee_in_crypto: 0,
          wallet: setup.wallet,
          fiat: setup.fiat,
          crypto: setup.crypto,
        },
        message: setup.wallet.address.includes('fib') ? 'Fiber invoice created successfully' : 'Payment initiated successfully',
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

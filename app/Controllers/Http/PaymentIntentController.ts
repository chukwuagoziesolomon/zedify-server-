import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import PaymentIntent from 'App/Models/PaymentIntent'
import PaymentIntentValidator from '../../Validators/PaymentIntentValidator'
import Currency from 'App/Models/Currency'
import { formatSuccessMessage, formatErrorMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import { CurrencyType, PaymentIntentStatus } from 'App/Lib/types'
import BusinessCurrencyController from './BusinessCurrencyController'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import CurrencyController from './CurrencyController'
import WalletService from 'App/Services/WalletService'
import Wallet from 'App/Models/Wallet'
import SseService from 'App/Services/SseService'
import TransactionService from 'App/Services/TransactionService'
import { DateTime } from 'luxon'
import QRCode from 'qrcode'
import { resolvePreferredCryptoCurrency } from 'App/helpers/cryptoCurrencySelection'
import PaymentSetupService from 'App/Services/PaymentSetupService'

export default class PaymentIntentController extends RolesController {
  private walletService: typeof WalletService = WalletService;

  // GET /api/user/payment-intent/history
  public async getTransactionHistory({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20
      const status = request.input('status')

      const query = PaymentIntent.query().where('businessId', userId)

      if (status) {
        query.where('status', String(status))
      }

      const transactions = await query.orderBy('createdAt', 'desc').paginate(page, limit)

      const enriched = await Promise.all(
        transactions.all().map(async (tx) => {
          const fiatCurrency = await Currency.query().where('unique_id', tx.fiatCurrencyId).first()
          const cryptoCurrency = tx.cryptoCurrencyId
            ? await Currency.query().where('unique_id', tx.cryptoCurrencyId).first()
            : null
          const cryptoNetwork = cryptoCurrency?.cryptoNetworkId
            ? await CryptoNetwork.query().where('unique_id', cryptoCurrency.cryptoNetworkId).first()
            : null
          const wallet = tx.walletId
            ? await Wallet.query().where('unique_id', tx.walletId).first()
            : null

          return {
            transaction_id: tx.uniqueId,
            reference_id: tx.businessReferenceId,
            amount: tx.fiatAmount,
            currency: {
              id: fiatCurrency?.uniqueId || null,
              name: fiatCurrency?.name || 'NGN',
              symbol: fiatCurrency?.symbol || 'NGN',
              logo: fiatCurrency?.logo || null,
            },
            status: tx.status,
            created_at: tx.createdAt?.toISO() || null,
            completed_at: tx.completedAt?.toISO() || null,
            wallet: wallet
              ? {
                  id: wallet.uniqueId,
                  address: wallet.walletAddress || null,
                  qr_code: wallet.qrCodeUrl || null,
                  status: wallet.status || null,
                }
              : null,
            crypto: cryptoCurrency
              ? {
                  id: cryptoCurrency.uniqueId,
                  name: cryptoCurrency.name,
                  symbol: cryptoCurrency.symbol,
                  logo: cryptoCurrency.logo || null,
                  contract_address: cryptoCurrency.contractAddress || null,
                }
              : null,
            network: cryptoNetwork
              ? {
                  id: cryptoNetwork.uniqueId,
                  name: cryptoNetwork.name,
                  logo: cryptoNetwork.logo || null,
                  is_testnet: Boolean(cryptoNetwork.isTestnet),
                }
              : null,
          }
        })
      )

      return response.ok({
        success: true,
        data: {
          meta: {
            total: transactions.total,
            per_page: transactions.perPage,
            current_page: transactions.currentPage,
            last_page: transactions.lastPage,
          },
          transactions: enriched,
        },
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // POST /api/client/payment-intent
  public async create({ request, response, auth }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const payload = await request.validate(PaymentIntentValidator)

      // Validate currency exists
      const fiatCurrency = await Currency.query().where('symbol', payload.fiat_currency).first()
      if (!fiatCurrency) {
        throw new Error('Invalid fiat currency')
      }

      // Ensure reference_id is unique for this business
      const existing = await PaymentIntent.query().where('businessReferenceId', payload.reference_id).andWhere('businessId', userId).first()
      if (existing) {
        throw new Error('Reference ID already used')
      }

      // Create payment intent
      await PaymentIntent.create({
        businessId: userId,
        businessReferenceId: payload.reference_id,
        fiatCurrencyId: fiatCurrency.uniqueId,
        fiatAmount: payload.fiat_amount,
        status: PaymentIntentStatus.PAYMENT_CREATED,
      })

      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(userId)

      const assets = await Promise.all(
        activeCurrencies.map(async (bc) => {
          const bcCurrency = await Currency.query().where('unique_id', bc.uniqueId).first()
          let network: { name: string; logo: string } | null = null

          if (bcCurrency && bcCurrency.type === CurrencyType.CRYPTO) {
            const cryptoNetwork = await CryptoNetwork.query().where('unique_id', bcCurrency.cryptoNetworkId).first()
            if (cryptoNetwork) {
              network = {
                name: cryptoNetwork.name,
                logo: cryptoNetwork.logo,
              }
            }
          }

          // Calculate the equivalent crypto amount
          let amount = 0
          if (bcCurrency) {
            amount = await CurrencyController.calculateCryptoEquivalent({
              fiatCurrencyId: fiatCurrency.uniqueId,
              fiatAmount: payload.fiat_amount,
              cryptoCurrencyId: bcCurrency.uniqueId,
            })
          }

          return {
            currency_id: bcCurrency?.uniqueId || '',
            name: bcCurrency?.name || '',
            symbol: bcCurrency?.symbol || '',
            logo: bcCurrency?.logo || '',
            network,
            amount,
          }
        })
      )
      // Emit SSE: transaction.created
      SseService.emit(userId, {
        event: 'transaction.created',
        data: {
          reference_id: payload.reference_id,
          amount: payload.fiat_amount,
          fiat_currency: payload.fiat_currency,
          status: PaymentIntentStatus.PAYMENT_CREATED,
        },
      })

      // Build response
      return response.ok(formatSuccessMessage('Payment intent created successfully', {
        fiat_amount: payload.fiat_amount,
        fiat_currency: payload.fiat_currency,
        reference_id: payload.reference_id,
        assets,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }


  public async createWallet({ request, response, auth }: HttpContextContract) {
    try {
      const userUniqueId = this.allowOnlyLoggedInUsers(auth)
      const userIntId = auth.use('user').user?.id as number
      const { crypto_currency_id, reference_id } = request.only(['crypto_currency_id', 'reference_id'])

      const activeCurrencies = await BusinessCurrencyController.getActiveCurrenciesForBusiness(userUniqueId)
      const resolvedCurrencies = (await Promise.all(
        activeCurrencies.map(async (bc) => Currency.query().where('unique_id', bc.uniqueId).first())
      )).filter((currency): currency is Currency => Boolean(currency))

      const preferredCurrency = resolvePreferredCryptoCurrency(resolvedCurrencies, crypto_currency_id)
      const cryptoCurrency = preferredCurrency ?? await Currency.query().where('symbol', crypto_currency_id).first()
      if (!cryptoCurrency) {
        throw new Error('Invalid crypto currency')
      }
      // Find the network for the crypto currency
      const cryptoNetwork = await CryptoNetwork.query().where('uniqueId', cryptoCurrency.cryptoNetworkId).first()
      if (!cryptoNetwork) {
        throw new Error('Crypto network not found')
      }
      // Get the payment intent by reference_id and user
      const paymentIntent = await PaymentIntent.query().where('businessReferenceId', reference_id).andWhere('businessId', userUniqueId).first()
      if (!paymentIntent) {
        throw new Error('Payment intent not found')
      }

      const setup = await PaymentSetupService.createPaymentSetup({
        paymentIntent,
        userUniqueId,
        userIntId,
        cryptoCurrency,
        referenceId: reference_id,
      })

      return response.ok({
        error: false,
        data: setup,
        message: setup.wallet.address.includes('fib') ? 'Fiber invoice created successfully' : 'Payment initiated successfully',
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

}

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

export default class PaymentIntentController extends RolesController {
  private walletService: typeof WalletService = WalletService;

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
      console.log({ activeCurrencies })

      const assets = await Promise.all(
        activeCurrencies.map(async (bc) => {
          const bcCurrency = await Currency.query().where('unique_id', bc.uniqueId).first()
          console.log({ bcCurrency })
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
      const userId = this.allowOnlyLoggedInUsers(auth)
      const { crypto_currency_id, reference_id } = request.only(['crypto_currency_id', 'reference_id'])

      // Validate crypto currency
      const cryptoCurrency = await Currency.query().where('unique_id', crypto_currency_id).first()
      if (!cryptoCurrency) {
        throw new Error('Invalid crypto currency')
      }
      // Find the network for the crypto currency
      const cryptoNetwork = await CryptoNetwork.query().where('unique_id', cryptoCurrency.cryptoNetworkId).first()
      if (!cryptoNetwork) {
        throw new Error('Crypto network not found')
      }
      // Get the payment intent by reference_id and user
      const paymentIntent = await PaymentIntent.query().where('businessReferenceId', reference_id).andWhere('businessId', userId).first()
      if (!paymentIntent) {
        throw new Error('Payment intent not found')
      }
      // console.log('damn!');return;

      // Use WalletService to create or reuse a wallet
      const wallet = await this.walletService.createChildWallet({
        userId,
        cryptoCurrencyId: cryptoCurrency.uniqueId,
      });

      // Update the payment intent with selected asset, network, and status
      paymentIntent.cryptoCurrencyId = cryptoCurrency.uniqueId
      paymentIntent.walletId = wallet.uniqueId
      // paymentIntent.status = PaymentIntentStatus.PAYMENT_CREATED
      await paymentIntent.save()
      // Calculate fee in crypto (mocked as 0.3 for now)
      const feeInCrypto = 0.3
      // Build response
      const fiatCurrency = await Currency.query().where('unique_id', paymentIntent.fiatCurrencyId).first()
      const fiat = {
        name: fiatCurrency?.name || '',
        symbol: fiatCurrency?.symbol || '',
        logo: fiatCurrency?.logo || '',
        amount: paymentIntent.fiatAmount,
      }
      const crypto = {
        name: cryptoCurrency.name,
        symbol: cryptoCurrency.symbol,
        logo: cryptoCurrency.logo,
        amount: 0, // You can use your calculateCryptoEquivalent here if needed
        network: {
          name: cryptoNetwork.name,
          logo: cryptoNetwork.logo,
        },
      }
      return response.ok({
        error: false,
        data: {
          reference_id: paymentIntent.businessReferenceId,
          expiration_time: '30000', // 30 mins
          payment_intent_id: paymentIntent.uniqueId,
          fee_in_crypto: feeInCrypto,
          wallet: {
            address: wallet.walletAddress,
            qr_code: wallet.qrCodeUrl,
          },
          fiat,
          crypto,
        },
        message: 'Payment initiated successfully',
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

}

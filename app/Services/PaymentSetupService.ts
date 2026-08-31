import { DateTime } from 'luxon'
import QRCode from 'qrcode'
import Logger from '@ioc:Adonis/Core/Logger'
import CurrencyController from 'App/Controllers/Http/CurrencyController'
import Currency from 'App/Models/Currency'
import PaymentIntent from 'App/Models/PaymentIntent'
import Wallet from 'App/Models/Wallet'
import WalletService from './WalletService'
import FiberInvoiceService from './FiberInvoiceService'
import TransactionService from './TransactionService'
import UserWallet from 'App/Models/UserWallet'
import { resolvePaymentFlowStrategy } from 'App/helpers/cryptoCurrencySelection'

interface CreatePaymentSetupParams {
  paymentIntent: PaymentIntent
  userUniqueId: string
  userIntId: number
  cryptoCurrency: Currency
  referenceId?: string
}

interface PaymentSetupResult {
  payment_intent_id: string
  transaction_id: string
  expires_at: string
  fee_in_crypto: number
  wallet: {
    address: string
    qr_code: string | null
  }
  fiat: {
    name: string
    symbol: string
    logo: string
    amount: number | null
  }
  crypto: {
    name: string
    symbol: string
    logo: string
    amount: number | null
    network: {
      name: string
      logo: string
    }
  }
}

class PaymentSetupService {
  public async createPaymentSetup(params: CreatePaymentSetupParams): Promise<PaymentSetupResult> {
    const { paymentIntent, userUniqueId, userIntId, cryptoCurrency, referenceId } = params

    await cryptoCurrency.load('cryptoNetwork')
    const cryptoNetwork = cryptoCurrency.cryptoNetwork

    const paymentIntentAmount = Number(paymentIntent.fiatAmount || 0)
    const amountCrypto = await CurrencyController.calculateCryptoEquivalent({
      fiatCurrencyId: paymentIntent.fiatCurrencyId,
      fiatAmount: paymentIntentAmount,
      cryptoCurrencyId: cryptoCurrency.uniqueId,
    })

    const paymentFlowStrategy = resolvePaymentFlowStrategy(cryptoNetwork)
    let walletAddress = ''
    let expiresAt = DateTime.now().plus({ minutes: 30 })
    let qrCodeDataUrl: string | null = null
    let wallet: Wallet | null = null

    if (paymentFlowStrategy === 'fiber_invoice') {
      const invoiceExpiresAt = DateTime.now().plus({ hours: 1 })
      const fiberInvoice = await FiberInvoiceService.createInvoiceForIntent(
        paymentIntent.uniqueId,
        String(userIntId),
        amountCrypto,
        `Payment for ${paymentIntent.businessReferenceId}`,
        3600
      )

      walletAddress = fiberInvoice.invoiceAddress
      expiresAt = invoiceExpiresAt
      paymentIntent.cryptoCurrencyId = cryptoCurrency.uniqueId
      paymentIntent.walletId = null
      await paymentIntent.save()
    } else {
      wallet = await WalletService.createChildWallet({
        userId: userUniqueId,
        cryptoCurrencyId: cryptoCurrency.uniqueId,
        refId: paymentIntent.uniqueId,
      })

      walletAddress = wallet.walletAddress
      paymentIntent.cryptoCurrencyId = cryptoCurrency.uniqueId
      paymentIntent.walletId = wallet.uniqueId
      await paymentIntent.save()
    }

    const existingUserWallet = await UserWallet.query()
      .where('userId', userIntId)
      .where('cryptoNetworkId', cryptoCurrency.cryptoNetworkId)
      .where('status', 'active')
      .first()

    try {
      qrCodeDataUrl = await QRCode.toDataURL(walletAddress, { width: 256, margin: 2 })
    } catch (error) {
      Logger.warn(`[PaymentSetupService] QR generation failed: ${error}`)
    }

    const transaction = await TransactionService.createReceiveTransaction({
      userId: userIntId,
      userWalletId: existingUserWallet?.uniqueId,
      cryptoNetworkId: cryptoCurrency.cryptoNetworkId,
      currencyId: cryptoCurrency.uniqueId,
      amountCrypto,
      amountUsd: paymentIntentAmount,
      walletAddressGenerated: walletAddress,
      qrCodeData: qrCodeDataUrl || undefined,
      paymentIntentId: paymentIntent.uniqueId,
      referenceId: referenceId || paymentIntent.businessReferenceId,
      description: `Payment for order ${paymentIntent.businessReferenceId}`,
      expiresAt,
      invoiceAddress: paymentFlowStrategy === 'fiber_invoice' ? walletAddress : undefined,
    })

    const fiatCurrency = await Currency.query().where('uniqueId', paymentIntent.fiatCurrencyId).first()

    return {
      payment_intent_id: paymentIntent.uniqueId,
      transaction_id: transaction.uniqueId,
      expires_at: expiresAt.toISO(),
      fee_in_crypto: 0,
      wallet: {
        address: walletAddress,
        qr_code: qrCodeDataUrl,
      },
      fiat: {
        name: fiatCurrency?.name || '',
        symbol: fiatCurrency?.symbol || '',
        logo: fiatCurrency?.logo || '',
        amount: paymentIntentAmount,
      },
      crypto: {
        name: cryptoCurrency.name,
        symbol: cryptoCurrency.symbol,
        logo: cryptoCurrency.logo,
        amount: amountCrypto,
        network: {
          name: cryptoNetwork.name,
          logo: cryptoNetwork.logo,
        },
      },
    }
  }
}

export default new PaymentSetupService()

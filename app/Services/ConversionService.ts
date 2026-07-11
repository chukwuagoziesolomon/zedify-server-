import Logger from '@ioc:Adonis/Core/Logger'
import Currency from 'App/Models/Currency'
import CoinGeckoService from './CoinGeckoService'

interface ConversionResult {
  fromCurrency: string // e.g., USDT
  toCurrency: string // e.g., NGN
  fromAmount: number
  fromRate: number // USDT rate in USD
  toRate: number // NGN rate in USD
  exchangeRate: number // Direct USDT → NGN rate
  toAmount: number // Converted amount
}

/**
 * ConversionService
 * Handles USDT → Naira (NGN) conversion for transfers
 * Fetches live rates from existing Currency model
 */
class ConversionServiceClass {
  /**
   * Get live USD price for a crypto symbol from CoinGecko.
   * Falls back to DB ratePerUsd if CoinGecko fails.
   */
  private async getLiveCryptoUsdPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase()

    try {
      const livePrice = await CoinGeckoService.getPrice(upperSymbol)
      if (livePrice && livePrice > 0) {
        Logger.info('[ConversionService] Using live CoinGecko price for %s: %s USD', upperSymbol, livePrice)
        return livePrice
      }
    } catch (error) {
      Logger.warn('[ConversionService] CoinGecko fetch failed for %s: %s', upperSymbol, error.message)
    }

    const currency = await Currency.query()
      .where('symbol', upperSymbol)
      .where('type', 'CRYPTO')
      .first()

    if (currency && currency.ratePerUsd > 0) {
      Logger.info('[ConversionService] Using DB fallback rate for %s: %s', upperSymbol, currency.ratePerUsd)
      return currency.ratePerUsd
    }

    throw new Error(`Unable to get USD price for ${upperSymbol}`)
  }

  /**
   * Get live fiat-to-USD rate from CoinGecko.
   * CoinGecko supports many fiat currencies via simple/price endpoint.
   * Falls back to DB ratePerUsd if CoinGecko fails.
   */
  private async getLiveFiatUsdRate(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase()

    if (upperSymbol === 'USD') {
      return 1
    }

    if (upperSymbol === 'NGN' || upperSymbol === 'USDT' || upperSymbol === 'USDC') {
      const currency = await Currency.query()
        .where('symbol', upperSymbol)
        .where('type', upperSymbol === 'NGN' ? 'FIAT' : 'CRYPTO')
        .first()

      if (currency && currency.ratePerUsd > 0) {
        return currency.ratePerUsd
      }
    }

    try {
      const prices = await CoinGeckoService.getPrices([upperSymbol])
      if (prices[upperSymbol] && prices[upperSymbol] > 0) {
        return 1 / prices[upperSymbol]
      }
    } catch (error) {
      Logger.warn('[ConversionService] CoinGecko fiat fetch failed for %s: %s', upperSymbol, error.message)
    }

    const currency = await Currency.query()
      .where('symbol', upperSymbol)
      .where('type', 'FIAT')
      .first()

    if (currency && currency.ratePerUsd > 0) {
      return currency.ratePerUsd
    }

    throw new Error(`Unable to get USD rate for ${upperSymbol}`)
  }

  /**
   * Convert USDT to Naira (NGN)
   * Formula: USDT amount × (NGN/USD rate ÷ USDT/USD rate)
   * Since USDT ≈ 1 USD: naira amount ≈ USDT amount × NGN/USD rate
   */
  async convertUsdtToNaira(
    usdtAmount: number,
    _cryptoNetworkId?: string
  ): Promise<ConversionResult> {
    try {
      Logger.info(
        `[ConversionService] Converting ${usdtAmount} USDT to NGN`
      )

      const usdtRate = await this.getLiveCryptoUsdPrice('USDT')
      const ngnRate = await this.getLiveFiatUsdRate('NGN')

      const ngnPerUsd = 1 / ngnRate
      const nairaAmount = usdtAmount * ngnPerUsd

      Logger.info(
        `[ConversionService] ${usdtAmount} USDT = ${nairaAmount.toFixed(2)} NGN (rate: 1 USDT = ${ngnPerUsd.toFixed(2)} NGN)`
      )

      return {
        fromCurrency: 'USDT',
        toCurrency: 'NGN',
        fromAmount: usdtAmount,
        fromRate: usdtRate,
        toRate: ngnRate,
        exchangeRate: ngnPerUsd,
        toAmount: nairaAmount,
      }
    } catch (error) {
      Logger.error(`[ConversionService] Conversion failed: ${error}`)
      throw error
    }
  }

  /**
   * Get current USDT → NGN exchange rate
   * Used for displaying rates to users during transfer
   */
  async getCurrentExchangeRate(): Promise<number> {
    try {
      const ngnRate = await this.getLiveFiatUsdRate('NGN')
      const ngnPerUsd = 1 / ngnRate
      return parseFloat(ngnPerUsd.toFixed(2))
    } catch (error) {
      Logger.error(`[ConversionService] Failed to get exchange rate: ${error}`)
      throw error
    }
  }

  /**
   * Validate conversion before processing
   */
  async validateConversion(usdtAmount: number): Promise<boolean> {
    try {
      if (usdtAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const result = await this.convertUsdtToNaira(usdtAmount)

      if (result.toAmount <= 0) {
        throw new Error('Conversion resulted in invalid amount')
      }

      return true
    } catch (error) {
      Logger.warn(`[ConversionService] Validation failed: ${error}`)
      return false
    }
  }

  /**
   * Convert CKB to USD
   * CKB is the native token of Nervos blockchain
   * Uses real-time CoinGecko price with DB fallback
   */
  async convertCkbToUsd(ckbAmount: number): Promise<number> {
    try {
      if (ckbAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const ckbRate = await this.getLiveCryptoUsdPrice('CKB')
      const usdAmount = ckbAmount * ckbRate

      Logger.info(
        `[ConversionService] Converted ${ckbAmount} CKB = ${usdAmount.toFixed(6)} USD (rate: 1 CKB = ${ckbRate} USD)`
      )

      return parseFloat(usdAmount.toFixed(6))
    } catch (error) {
      Logger.error(`[ConversionService] CKB conversion failed: ${error}`)
      throw error
    }
  }

  /**
   * Convert SUDT token amount to USD
   * SUDT tokens have variable rates like any cryptocurrency
   * Uses real-time CoinGecko price with DB fallback
   */
  async convertSudtToUsd(sudtAmount: number, sudtSymbol: string): Promise<number> {
    try {
      if (sudtAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const rate = await this.getLiveCryptoUsdPrice(sudtSymbol)
      const usdAmount = sudtAmount * rate

      Logger.info(
        `[ConversionService] Converted ${sudtAmount} ${sudtSymbol} = ${usdAmount.toFixed(6)} USD (rate: 1 ${sudtSymbol} = ${rate} USD)`
      )

      return parseFloat(usdAmount.toFixed(6))
    } catch (error) {
      Logger.error(`[ConversionService] SUDT conversion failed: ${error}`)
      throw error
    }
  }

  /**
   * Calculate platform fee (default 5%)
   */
  calculatePlatformFee(usdAmount: number, feePercentage: number = 5): number {
    const fee = (usdAmount * feePercentage) / 100
    return parseFloat(fee.toFixed(2))
  }

  /**
   * Calculate net amount after platform fee
   */
  calculateNetAmount(usdAmount: number, feePercentage: number = 5): number {
    const fee = this.calculatePlatformFee(usdAmount, feePercentage)
    const net = usdAmount - fee
    return parseFloat(net.toFixed(2))
  }
}

export default new ConversionServiceClass()

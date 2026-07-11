import Logger from '@ioc:Adonis/Core/Logger'
import Currency from 'App/Models/Currency'

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
   * Convert USDT to Naira (NGN)
   * Formula: USDT amount × (NGN/USD rate ÷ USDT/USD rate)
   * Since USDT ≈ 1 USD: naira amount ≈ USDT amount × NGN/USD rate
   */
  async convertUsdtToNaira(
    usdtAmount: number,
    cryptoNetworkId?: string
  ): Promise<ConversionResult> {
    try {
      Logger.info(
        `[ConversionService] Converting ${usdtAmount} USDT to NGN`
      )

      // Get USDT currency (typically pegged to USD at 1:1)
      const query = Currency.query()
        .where('symbol', 'USDT')
        .where('type', 'CRYPTO')

      if (cryptoNetworkId) {
        query.where('cryptoNetworkId', cryptoNetworkId)
      }

      const usdt = await query.first()

      if (!usdt) {
        throw new Error('USDT currency not found in system')
      }

      // Get NGN (Naira) currency
      const ngn = await Currency.query()
        .where('symbol', 'NGN')
        .where('type', 'FIAT')
        .first()

      if (!ngn) {
        throw new Error('NGN currency not found in system')
      }

      // Calculate exchange rate
      // USDT rate is in USD (should be ~1.0)
      // NGN rate is in USD (e.g., 0.00064 meaning 1 NGN = 0.00064 USD)
      // So: 1 USDT ≈ 1 USD, and 1 USD ≈ 1/0.00064 NGN

      const ngnPerUsd = 1 / ngn.ratePerUsd
      const nairaAmount = usdtAmount * ngnPerUsd

      Logger.info(
        `[ConversionService] ${usdtAmount} USDT = ${nairaAmount.toFixed(2)} NGN (rate: 1 USDT = ${ngnPerUsd.toFixed(2)} NGN)`
      )

      return {
        fromCurrency: usdt.symbol,
        toCurrency: ngn.symbol,
        fromAmount: usdtAmount,
        fromRate: usdt.ratePerUsd,
        toRate: ngn.ratePerUsd,
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
      const usdt = await Currency.query()
        .where('symbol', 'USDT')
        .where('type', 'CRYPTO')
        .first()

      const ngn = await Currency.query()
        .where('symbol', 'NGN')
        .where('type', 'FIAT')
        .first()

      if (!usdt || !ngn) {
        throw new Error('USDT or NGN currency not found')
      }

      const ngnPerUsd = 1 / ngn.ratePerUsd
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
   * 1 CKB = rate USD (fetched from Currency model)
   */
  async convertCkbToUsd(ckbAmount: number): Promise<number> {
    try {
      if (ckbAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      // Get CKB currency from database
      const ckb = await Currency.query()
        .where('symbol', 'CKB')
        .where('type', 'CRYPTO')
        .first()

      if (!ckb) {
        throw new Error('CKB currency not found in system')
      }

      // Convert: CKB amount × CKB/USD rate
      const usdAmount = ckbAmount * ckb.ratePerUsd

      Logger.info(
        `[ConversionService] Converted ${ckbAmount} CKB = ${usdAmount.toFixed(6)} USD (rate: 1 CKB = ${ckb.ratePerUsd} USD)`
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
   */
  async convertSudtToUsd(sudtAmount: number, sudtSymbol: string): Promise<number> {
    try {
      if (sudtAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      // Look up SUDT token rate
      const sudt = await Currency.query()
        .where('symbol', sudtSymbol)
        .where('type', 'CRYPTO')
        .first()

      if (!sudt) {
        throw new Error(`${sudtSymbol} currency not found in system`)
      }

      // Convert: SUDT amount × SUDT/USD rate
      const usdAmount = sudtAmount * sudt.ratePerUsd

      Logger.info(
        `[ConversionService] Converted ${sudtAmount} ${sudtSymbol} = ${usdAmount.toFixed(6)} USD (rate: 1 ${sudtSymbol} = ${sudt.ratePerUsd} USD)`
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

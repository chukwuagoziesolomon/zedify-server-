import axios from 'axios'
import Logger from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env'

export interface CoinGeckoPriceResponse {
  [coinId: string]: {
    usd: number
  }
}

export interface CoinGeckoCoinMapping {
  symbol: string
  coingeckoId: string
}

const COINGECKO_API_BASE = Env.get('COINGECKO_API_BASE', 'https://api.coingecko.com/api/v3')
const COINGECKO_API_KEY = Env.get('COINGECKO_API_KEY', '')

const COIN_MAPPINGS: CoinGeckoCoinMapping[] = [
  { symbol: 'CKB', coingeckoId: 'nervos-network' },
  { symbol: 'USDT', coingeckoId: 'tether' },
  { symbol: 'USDC', coingeckoId: 'usd-coin' },
  { symbol: 'BTC', coingeckoId: 'bitcoin' },
  { symbol: 'ETH', coingeckoId: 'ethereum' },
  { symbol: 'BNB', coingeckoId: 'binancecoin' },
  { symbol: 'SOL', coingeckoId: 'solana' },
  { symbol: 'MATIC', coingeckoId: 'matic-network' },
  { symbol: 'AVAX', coingeckoId: 'avalanche-2' },
  { symbol: 'LINK', coingeckoId: 'chainlink' },
]

class CoinGeckoServiceClass {
  private cache: Map<string, { prices: Record<string, number>; timestamp: number }> = new Map()
  private readonly CACHE_TTL_MS = 60_000 // 1 minute cache

  /**
   * Get CoinGecko ID for a currency symbol
   */
  private getCoingeckoId(symbol: string): string | null {
    const upper = symbol.toUpperCase()
    const mapping = COIN_MAPPINGS.find((m) => m.symbol === upper)
    return mapping?.coingeckoId || null
  }

  /**
   * Build CoinGecko IDs list from symbols
   */
  private buildCoingeckoIds(symbols: string[]): string[] {
    const ids: string[] = []
    const seen = new Set<string>()

    for (const symbol of symbols) {
      const coingeckoId = this.getCoingeckoId(symbol)
      if (coingeckoId && !seen.has(coingeckoId)) {
        ids.push(coingeckoId)
        seen.add(coingeckoId)
      }
    }

    return ids
  }

  /**
   * Fetch prices from CoinGecko for multiple coins at once
   * Returns a map of symbol -> price in USD
   */
  public async getPrices(symbols: string[]): Promise<Record<string, number>> {
    try {
      const coingeckoIds = this.buildCoingeckoIds(symbols)

      if (coingeckoIds.length === 0) {
        Logger.warn('[CoinGecko] No supported symbols in request: %s', symbols.join(', '))
        return {}
      }

      const cacheKey = coingeckoIds.sort().join(',')
      const cached = this.cache.get(cacheKey)
      const now = Date.now()

      if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
        Logger.info('[CoinGecko] Returning cached prices for %d coins', coingeckoIds.length)
        return this.mapPricesToSymbols(coingeckoIds, cached.prices)
      }

      const idsParam = coingeckoIds.join(',')
      const url = `${COINGECKO_API_BASE}/simple/price?ids=${idsParam}&vs_currencies=usd`

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (COINGECKO_API_KEY) {
        headers['x-cg-demo-api-key'] = COINGECKO_API_KEY
      }

      Logger.info('[CoinGecko] Fetching prices for: %s', idsParam)

      const response = await axios.get<CoinGeckoPriceResponse>(url, { headers, timeout: 10_000 })

      if (!response.data) {
        throw new Error('Empty response from CoinGecko')
      }

      const prices: Record<string, number> = {}
      for (const [coingeckoId, data] of Object.entries(response.data)) {
        prices[coingeckoId] = data.usd
      }

      const result = this.mapPricesToSymbols(coingeckoIds, prices)
      Logger.info('[CoinGecko] Fetched prices for %d coins', Object.keys(result).length)
      this.cache.set(cacheKey, { prices, timestamp: now })
      return result

      return result
    } catch (error) {
      Logger.error('[CoinGecko] Failed to fetch prices: %s', error.message)
      return {}
    }
  }

  /**
   * Map CoinGecko IDs back to currency symbols
   */
  private mapPricesToSymbols(coingeckoIds: string[], prices: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {}

    for (const mapping of COIN_MAPPINGS) {
      if (coingeckoIds.includes(mapping.coingeckoId)) {
        const price = prices[mapping.coingeckoId]
        if (typeof price === 'number' && price > 0) {
          result[mapping.symbol] = price
        }
      }
    }

    return result
  }

  /**
   * Get a single coin price in USD
   */
  public async getPrice(symbol: string): Promise<number | null> {
    const prices = await this.getPrices([symbol])
    return prices[symbol.toUpperCase()] || null
  }

  /**
   * Get CKB price in USD
   */
  public async getCkbPrice(): Promise<number | null> {
    return this.getPrice('CKB')
  }

  /**
   * Get USDT price in USD (should be ~1.0)
   */
  public async getUsdtPrice(): Promise<number | null> {
    return this.getPrice('USDT')
  }

  /**
   * Convert CKB amount to USD using real-time CoinGecko price
   */
  public async convertCkbToUsd(ckbAmount: number): Promise<number> {
    if (ckbAmount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const ckbPrice = await this.getCkbPrice()
    if (!ckbPrice) {
      throw new Error('Failed to fetch CKB price from CoinGecko')
    }

    const usdAmount = ckbAmount * ckbPrice
    Logger.info('[CoinGecko] Converted %s CKB = %s USD (rate: 1 CKB = %s USD)', ckbAmount, usdAmount.toFixed(6), ckbPrice)
    return parseFloat(usdAmount.toFixed(6))
  }

  /**
   * Convert USD to CKB using real-time CoinGecko price
   */
  public async convertUsdToCkb(usdAmount: number): Promise<number> {
    if (usdAmount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const ckbPrice = await this.getCkbPrice()
    if (!ckbPrice) {
      throw new Error('Failed to fetch CKB price from CoinGecko')
    }

    const ckbAmount = usdAmount / ckbPrice
    Logger.info('[CoinGecko] Converted %s USD = %s CKB (rate: 1 CKB = %s USD)', usdAmount, ckbAmount.toFixed(6), ckbPrice)
    return parseFloat(ckbAmount.toFixed(6))
  }

  /**
   * Convert any crypto amount to USD
   */
  public async convertCryptoToUsd(symbol: string, amount: number): Promise<number> {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const price = await this.getPrice(symbol)
    if (!price) {
      throw new Error(`Failed to fetch ${symbol} price from CoinGecko`)
    }

    const usdAmount = amount * price
    Logger.info('[CoinGecko] Converted %s %s = %s USD (rate: 1 %s = %s USD)', amount, symbol, usdAmount.toFixed(6), symbol, price)
    return parseFloat(usdAmount.toFixed(6))
  }

  /**
   * Clear price cache (useful for testing or manual refresh)
   */
  public clearCache(): void {
    this.cache.clear()
    Logger.info('[CoinGecko] Cache cleared')
  }
}

export default new CoinGeckoServiceClass()

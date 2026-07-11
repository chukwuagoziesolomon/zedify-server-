import Currency from 'App/Models/Currency'
import CoinGeckoService from 'App/Services/CoinGeckoService'

export default class CurrencyRatesController {

  public async getCryptoUsdRate(symbol: string): Promise<number> {
    try {
      const upperSymbol = symbol.toUpperCase()

      const livePrice = await CoinGeckoService.getPrice(upperSymbol)
      if (livePrice && livePrice > 0) {
        return 1 / livePrice
      }

      const currency = await Currency.query()
        .where('symbol', upperSymbol)
        .where('type', 'CRYPTO')
        .first()

      if (currency && currency.ratePerUsd > 0) {
        return currency.ratePerUsd
      }

      throw new Error(`Unable to fetch rate for ${upperSymbol}`)
    } catch (error) {
      throw new Error(`fetching crypto rates failed: ${error.message}`)
    }
  }

  public async getFiatUsdRate(symbol: string): Promise<number> {
    try {
      const upperSymbol = symbol.toUpperCase()

      if (upperSymbol === 'USD') {
        return 1
      }

      const prices = await CoinGeckoService.getPrices([upperSymbol])
      if (prices[upperSymbol] && prices[upperSymbol] > 0) {
        return 1 / prices[upperSymbol]
      }

      const currency = await Currency.query()
        .where('symbol', upperSymbol)
        .where('type', 'FIAT')
        .first()

      if (currency && currency.ratePerUsd > 0) {
        return currency.ratePerUsd
      }

      throw new Error(`Unable to fetch fiat rate for ${upperSymbol}`)
    } catch (error) {
      throw new Error(`fetching fiat rates failed: ${error.message}`)
    }
  }

  /**
   * Refresh all currency rates from CoinGecko
   * GET /api/admin/currency/refresh-rates
   */
  public async refreshRates({ response }: any) {
    try {
      const currencies = await Currency.query().where('isDeleted', false)
      const symbols = currencies.map((c) => c.symbol)

      const prices = await CoinGeckoService.getPrices(symbols)

      let updated = 0
      for (const currency of currencies) {
        const price = prices[currency.symbol.toUpperCase()]
        if (price && price > 0) {
          currency.ratePerUsd = 1 / price
          await currency.save()
          updated++
        }
      }

      return response.ok({
        success: true,
        message: `Updated ${updated} currency rates from CoinGecko`,
        data: { updated, total: currencies.length },
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: `Failed to refresh rates: ${error.message}`,
      })
    }
  }
}

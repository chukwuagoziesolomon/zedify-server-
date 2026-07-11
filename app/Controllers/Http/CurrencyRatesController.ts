import { Request } from "App/helpers/https";
import Env from '@ioc:Adonis/Core/Env'

export default class CurrencyRatesController {

  public async getCryptoUsdRate(symbol) {
    try {
      let url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`;
      let config = {
        headers: {
          'X-CMC_PRO_API_KEY': Env.get('COINMARKET_API_KEY')
        }
      }
      let response = await Request.get(url, config)
      if (!response.ok)
        throw new Error('fetching crypto rates failed!')

      let data = response.data.data.data;
      let tokenDetails;
      if (data.hasOwnProperty(symbol))
        tokenDetails = data[symbol]

      let usdRate = (symbol === 'USDT' || symbol === 'USDC') ? 1 : tokenDetails.quote.USD.price;
      return 1 / usdRate
    } catch (error) {
      throw new Error(error)
    }
  }

  public async getFiatUsdRate(symbol) {
    try {
      // let url = `https://openexchangerates.org/api/latest.json?app_id=${process.env.OPEN_EXCHANGE_API_ID}&symbols=${symbol}`
      let url = `https://min-api.cryptocompare.com/data/price?fsym=USDT&tsyms=${symbol}`;
      let response = await Request.get(url, {})
      if (!response.ok)
        throw new Error('fetching fiat rates failed!')

      return response.data.data[symbol];
    } catch (error) {
      throw new Error(error)
    }
  }

}

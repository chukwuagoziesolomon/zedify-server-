import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Env from '@ioc:Adonis/Core/Env'
import { CurrencyType } from 'App/Lib/types'

export default class extends BaseSeeder {
  public async run() {
    let currency = await Currency.query()
    if (currency.length > 0) return;

    // Get network references
    const bscNetwork = await CryptoNetwork.query().where('name', 'Binance Smart Chain').first()
    const baseNetwork = await CryptoNetwork.query().where('name', 'Base').first()
    const baseSepoliaNetwork = await CryptoNetwork.query().where('name', 'Base Sepolia Testnet').first()

    // Fiat Currency
    await Currency.create({
      type: CurrencyType.FIAT,
      name: "Nigerian Naira",
      symbol: "NGN",
      logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/ngn-logo.svg`,
      cryptoNetworkId: undefined,
      ratePerUsd: 0.0012,
      contractAddress: null
    })

    // USDC for Base (Mainnet)
    if (baseNetwork) {
      await Currency.create({
        type: CurrencyType.CRYPTO,
        name: "USD COIN",
        symbol: "USDC",
        logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/usdc-logo.svg`,
        cryptoNetworkId: baseNetwork.uniqueId,
        ratePerUsd: 1,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base mainnet
      })
    }

    // USDT for BSC (Mainnet)
    if (bscNetwork) {
      await Currency.create({
        type: CurrencyType.CRYPTO,
        name: "USDT TETHER",
        symbol: "USDT",
        logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/usdt-logo.svg`,
        cryptoNetworkId: bscNetwork.uniqueId,
        ratePerUsd: 1,
        contractAddress: "0x55d398326f99059fF775485246999027B3197955" // USDT on BSC mainnet
      })
    }

    // Both USDC and USDT for Base Sepolia Testnet
    if (baseSepoliaNetwork) {
      await Currency.create({
        type: CurrencyType.CRYPTO,
        name: "USD COIN",
        symbol: "USDC",
        logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/usdc-logo.svg`,
        cryptoNetworkId: baseSepoliaNetwork.uniqueId,
        ratePerUsd: 1,
        contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7c" // USDC on Base Sepolia testnet
      })

      await Currency.create({
        type: CurrencyType.CRYPTO,
        name: "USDT TETHER",
        symbol: "USDT",
        logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/usdt-logo.svg`,
        cryptoNetworkId: baseSepoliaNetwork.uniqueId,
        ratePerUsd: 1,
        contractAddress: "0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73" // USDT on Base Sepolia testnet
      })
    }

    // // USDT for AssetChain Testnet
    // if (assetchainTestnetNetwork) {
    //   await Currency.create({
    //     type: "crypto",
    //     name: "USDT TETHER",
    //     symbol: "USDT",
    //     logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/usdt-logo.svg`,
    //     cryptoNetworkId: assetchainTestnetNetwork.id,
    //     ratePerUsd: 1,
    //     contractAddress: "0x1234567890123456789012345678901234567890" // Placeholder for AssetChain testnet USDT
    //   })
    // }

    // // Add some additional common cryptocurrencies
    // if (bscNetwork) {
    //   await Currency.create({
    //     type: "crypto",
    //     name: "BNB",
    //     symbol: "BNB",
    //     logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/bnb-logo.svg`,
    //     cryptoNetworkId: bscNetwork.id,
    //     ratePerUsd: 300, // Approximate BNB price
    //     contractAddress: null // Native token doesn't have contract address
    //   })
    // }

    // if (baseNetwork) {
    //   await Currency.create({
    //     type: "crypto",
    //     name: "Ethereum",
    //     symbol: "ETH",
    //     logo: `${Env.get('CLIENT_URL', 'http://localhost:3000')}/icons/eth-logo.svg`,
    //     cryptoNetworkId: baseNetwork.id,
    //     ratePerUsd: 2500, // Approximate ETH price
    //     contractAddress: null // Native token doesn't have contract address
    //   })
    // }

    console.log('✅ Currency seeder completed')
  }
}

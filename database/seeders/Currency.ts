import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Env from '@ioc:Adonis/Core/Env'
import { CurrencyType } from 'App/Lib/types'

export default class extends BaseSeeder {
  public async run() {
    let currency = await Currency.query()
    if (currency.length > 0) return;

    const clientUrl = Env.get('CLIENT_URL', 'http://localhost:3000')

    // Helper to build icon URL
    const icon = (name: string) => `${clientUrl}/icons/${name}`

    // -------------------------------------------------------------------------
    // Fetch network rows
    // -------------------------------------------------------------------------
    const [
      bscNetwork,
      baseNetwork,
      polygonNetwork,
      optimismNetwork,
      arbitrumNetwork,
      ethereumNetwork,
      baseSepoliaNetwork,
      ckbTestnetNetwork,
      solanaNetwork,
      tronNetwork,
    ] = await Promise.all([
      CryptoNetwork.query().where('name', 'Binance Smart Chain').first(),
      CryptoNetwork.query().where('name', 'Base').first(),
      CryptoNetwork.query().where('name', 'Polygon').first(),
      CryptoNetwork.query().where('name', 'Optimism').first(),
      CryptoNetwork.query().where('name', 'Arbitrum One').first(),
      CryptoNetwork.query().where('name', 'Ethereum').first(),
      CryptoNetwork.query().where('name', 'Base Sepolia Testnet').first(),
      CryptoNetwork.query().where('name', 'Nervos CKB Testnet').first(),
      CryptoNetwork.query().where('name', 'Solana').first(),
      CryptoNetwork.query().where('name', 'Tron').first(),
    ])

    // -------------------------------------------------------------------------
    // Fiat Currencies
    // -------------------------------------------------------------------------
    await Currency.create({
      type: CurrencyType.FIAT,
      name: 'Nigerian Naira',
      symbol: 'NGN',
      logo: icon('ngn-logo.svg'),
      cryptoNetworkId: undefined,
      ratePerUsd: 0.0012,
      contractAddress: null,
    })

    // -------------------------------------------------------------------------
    // Mainnet — Binance Smart Chain
    // -------------------------------------------------------------------------
    if (bscNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: bscNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x55d398326f99059fF775485246999027B3197955',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: bscNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Mainnet — Base
    // -------------------------------------------------------------------------
    if (baseNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: baseNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: baseNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Mainnet — Polygon
    // -------------------------------------------------------------------------
    if (polygonNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: polygonNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: polygonNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Mainnet — Optimism
    // -------------------------------------------------------------------------
    if (optimismNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: optimismNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: optimismNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Mainnet — Arbitrum One
    // -------------------------------------------------------------------------
    if (arbitrumNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: arbitrumNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: arbitrumNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Mainnet — Ethereum
    // -------------------------------------------------------------------------
    if (ethereumNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: ethereumNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: ethereumNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Testnet — Base Sepolia
    // -------------------------------------------------------------------------
    if (baseSepoliaNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: baseSepoliaNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7c',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: baseSepoliaNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: '0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Testnet — Nervos CKB (non-EVM native token)
    // -------------------------------------------------------------------------
    if (ckbTestnetNetwork) {
      await Currency.create({
        type: CurrencyType.CRYPTO,
        name: 'Nervos CKB',
        symbol: 'CKB',
        logo: icon('ckb-logo.svg'),
        cryptoNetworkId: ckbTestnetNetwork.uniqueId,
        ratePerUsd: 0.005,
        contractAddress: null,
      })
    }

    // -------------------------------------------------------------------------
    // Solana
    // -------------------------------------------------------------------------
    if (solanaNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'Solana',
          symbol: 'SOL',
          logo: icon('solana-logo.svg'),
          cryptoNetworkId: solanaNetwork.uniqueId,
          ratePerUsd: 150,
          contractAddress: null,
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: solanaNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        },
      ])
    }

    // -------------------------------------------------------------------------
    // Tron
    // -------------------------------------------------------------------------
    if (tronNetwork) {
      await Currency.createMany([
        {
          type: CurrencyType.CRYPTO,
          name: 'Tron',
          symbol: 'TRX',
          logo: icon('tron-logo.svg'),
          cryptoNetworkId: tronNetwork.uniqueId,
          ratePerUsd: 0.25,
          contractAddress: null,
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USDT Tether',
          symbol: 'USDT',
          logo: icon('usdt-logo.svg'),
          cryptoNetworkId: tronNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        },
        {
          type: CurrencyType.CRYPTO,
          name: 'USD Coin',
          symbol: 'USDC',
          logo: icon('usdc-logo.svg'),
          cryptoNetworkId: tronNetwork.uniqueId,
          ratePerUsd: 1,
          contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32Run966rdz8',
        },
      ])
    }

    console.log('✅ Currency seeder completed')
  }
}


import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import SudtRegistry from 'App/Models/SudtRegistry'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import { CurrencyType } from 'App/Lib/types'
import { v4 as uuid } from 'uuid'

/**
 * SUDT Token Registry Seeder
 *
 * SUDT = Simple User Defined Token (CKB's token standard, like ERC-20 on Ethereum)
 * Examples:
 *   - RUSD  = Reserve USD (a stablecoin that uses the SUDT standard)
 *   - USDC  = USD Coin (bridged to CKB via SUDT)
 *   - FIBB  = Fiber Token (the Fiber network's native reward token)
 *
 * Each token is identified by its type_script (code_hash + hash_type + args).
 * This is how Fiber knows which token a payment is for.
 */
export default class SudtRegistrySeeder extends BaseSeeder {
  public async run() {
    const existing = await SudtRegistry.query()
    if (existing.length > 0) return

    // -------------------------------------------------------------------------
    // RUSD — Reserve USD (TESTNET)
    // From Fiber docs: https://testnet0815.stablepp.xyz/stablecoin
    // -------------------------------------------------------------------------
    const rusdTestnetTypeScript = JSON.stringify({
      code_hash: '0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a',
      hash_type: 'type',
      args: '0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b',
    })

    await SudtRegistry.createMany([
      {
        uniqueId: uuid(),
        typeScript: rusdTestnetTypeScript,
        symbol: 'RUSD',
        name: 'Reserve USD',
        decimals: 8,
        logo: 'https://raw.githubusercontent.com/stablepp/assets/main/rusd.png',
        network: 'testnet',
        issuer: 'StablePP (testnet0815.stablepp.xyz)',
        enabled: true,
      },
      {
        uniqueId: uuid(),
        typeScript: JSON.stringify({
          code_hash: '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
          hash_type: 'data1',
          args: '0x',
        }),
        symbol: 'FIBB',
        name: 'Fiber Token (Testnet)',
        decimals: 8,
        logo: 'https://raw.githubusercontent.com/nervosnetwork/fiber/main/assets/fibb.png',
        network: 'testnet',
        issuer: 'Nervos Foundation',
        enabled: true,
      },
    ])

    console.log('✅ SudtRegistry seeder completed (RUSD, FIBB added)')

    // -------------------------------------------------------------------------
    // Also add RUSD to the Currency table so ConversionService can convert it
    // -------------------------------------------------------------------------
    const fiberNetwork = await CryptoNetwork.query()
      .where('chainKey', 'fiber-testnet')
      .first()

    if (fiberNetwork) {
      const rusdExists = await Currency.query()
        .where('symbol', 'RUSD')
        .first()

      if (!rusdExists) {
        await Currency.create({
          type: CurrencyType.CRYPTO,
          name: 'Reserve USD',
          symbol: 'RUSD',
          logo: 'https://raw.githubusercontent.com/stablepp/assets/main/rusd.png',
          cryptoNetworkId: fiberNetwork.uniqueId,
          ratePerUsd: 1.0, // RUSD is pegged 1:1 to USD
          contractAddress: null,
        })
        console.log('✅ RUSD added to Currency table (rate: 1 RUSD = $1 USD)')
      }

      const fibbExists = await Currency.query()
        .where('symbol', 'FIBB')
        .first()

      if (!fibbExists) {
        const ckbRate = (await Currency.query().where('symbol', 'CKB').first())?.ratePerUsd || 0.005
        await Currency.create({
          type: CurrencyType.CRYPTO,
          name: 'Fiber Token',
          symbol: 'FIBB',
          logo: 'https://raw.githubusercontent.com/nervosnetwork/fiber/main/assets/fibb.png',
          cryptoNetworkId: fiberNetwork.uniqueId,
          ratePerUsd: ckbRate, // FIBB tracks CKB rate (adjust when real rate available)
          contractAddress: null,
        })
        console.log('✅ FIBB added to Currency table')
      }
    }
  }
}

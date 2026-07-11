import { WalletSDK } from 'contract-wallet-sdk'
import { EvmChain } from 'contract-wallet-sdk/dist/walletsdk/types/types'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Wallet from 'App/Models/Wallet'
import Currency from 'App/Models/Currency'
import PaymentIntent from 'App/Models/PaymentIntent'
import CryptoNetwork from 'App/Models/CryptoNetwork'

const OWNER_EVM_PRIVATE_KEY = Env.get('OWNER_EVM_PRIVATE_KEY', '')

/**
 * SettlementService
 *
 * After a payment is confirmed, this service flushes funds from the
 * child smart-contract wallet back to the master wallet using the
 * contract-wallet-sdk's `flush()` (native token) or `flushTokens()`
 * (ERC-20) calls.
 *
 * The child wallet was deployed with `enableAutoFlush: true`, which means
 * the contract will forward incoming transfers automatically. This service
 * acts as a manual fallback / explicit settlement trigger after confirmation.
 */
class SettlementServiceClass {
  /**
   * Settle a single child wallet: flush all funds to the master wallet.
   *
   * @param walletId  - uniqueId of the Wallet row
   * @param paymentIntentId - uniqueId of the PaymentIntent (used to look up currency/contract)
   */
  public async settleWallet(walletId: string, paymentIntentId: string): Promise<void> {
    try {
      const wallet = await Wallet.query().where('uniqueId', walletId).firstOrFail()

      const paymentIntent = await PaymentIntent.query()
        .where('uniqueId', paymentIntentId)
        .firstOrFail()

      if (!paymentIntent.cryptoCurrencyId) {
        Logger.warn(`[Settlement] No crypto currency on intent ${paymentIntentId} — skipping flush`)
        return
      }

      const currency = await Currency.query()
        .where('uniqueId', paymentIntent.cryptoCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail()

      const network = currency.cryptoNetwork

      if (network.networkType !== 'evm') {
        Logger.info(`[Settlement] Non-EVM wallet ${walletId} — skipping (handled separately)`)
        return
      }

      await this.flushEVMWallet(wallet, network, currency.contractAddress)

      // Mark wallet as flushed so it won't be selected for reuse
      wallet.status = 'flushed'
      await wallet.save()

      Logger.info(`[Settlement] Wallet ${walletId} flushed successfully`)
    } catch (error) {
      // Settlement failures must not block payment confirmation
      Logger.error(`[Settlement] Failed to settle wallet ${walletId}: ${error}`)
    }
  }

  /**
   * Flush an EVM child wallet using the SDK.
   * - If the currency is a native token (no contractAddress), calls `flush()`
   * - If the currency is an ERC-20 token, calls `flushTokens({ tokenAddress_ })`
   */
  private async flushEVMWallet(
    wallet: Wallet,
    network: CryptoNetwork,
    contractAddress: string | null
  ): Promise<void> {
    const sdk = new WalletSDK(
      network.chainKey as EvmChain,
      'evm',
      network.isTestnet ? 'testnet' : 'mainnet',
      OWNER_EVM_PRIVATE_KEY,
      wallet.walletAddress  // deployedAddress — tells the SDK which contract to call on
    )

    if (contractAddress) {
      Logger.info(
        `[Settlement] Flushing ERC-20 token ${contractAddress} from wallet ${wallet.walletAddress} on ${network.name}`
      )
      await sdk.flushTokens({ tokenAddress_: contractAddress })
    } else {
      Logger.info(
        `[Settlement] Flushing native token from wallet ${wallet.walletAddress} on ${network.name}`
      )
      await sdk.flush()
    }
  }
}

export default new SettlementServiceClass()

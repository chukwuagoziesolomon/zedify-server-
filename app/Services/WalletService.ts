import Wallet from 'App/Models/Wallet'
import PaymentIntent from 'App/Models/PaymentIntent'
import { PaymentIntentStatus, WalletType } from '../Lib/types'
import Currency from 'App/Models/Currency'
import Env from '@ioc:Adonis/Core/Env'
import { WalletSDK } from 'contract-wallet-sdk';
import Database from '@ioc:Adonis/Lucid/Database'
import { EvmChain } from 'contract-wallet-sdk/dist/walletsdk/types/types'

interface CreateChildWalletParams {
  userId: string;
  cryptoCurrencyId: string
}

const OWNER_EVM_PRIVATE_KEY = Env.get('OWNER_EVM_PRIVATE_KEY', '')

class WalletService {
  /**
   * Create or reuse a wallet for a business/payment intent.
   * Prevents race conditions using a transaction and row-level lock.
   */
  public async createChildWallet({ userId, cryptoCurrencyId }: CreateChildWalletParams): Promise<Wallet> {
    return await Database.transaction(async (trx) => {
      // Fetch crypto currency and its network
      const cryptoCurrency = await Currency.query({ client: trx })
        .where('uniqueId', cryptoCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail();

      // Find all wallets for this user/business on this network, lock them for update
      const wallets = await Wallet.query({ client: trx })
        .where('userId', userId)
        .andWhere('cryptoNetworkId', cryptoCurrency.cryptoNetworkId)
        .forUpdate();

      // Try to find a wallet with a completed payment
      for (const wallet of wallets) {
        const completedIntent = await PaymentIntent.query({ client: trx })
          .where('walletId', wallet.uniqueId)
          .andWhere('status', PaymentIntentStatus.PAYMENT_COMPLETED)
          .first();

        if (completedIntent) return wallet;
      }

      const walletSdk = new WalletSDK(
        cryptoCurrency?.cryptoNetwork.chainKey as EvmChain,
        'evm',
        cryptoCurrency?.cryptoNetwork.isTestnet ? 'testnet' : 'mainnet',
        OWNER_EVM_PRIVATE_KEY
      );

      const salt = `HOLMES_${Date.now()}`;
      const deployAddressParam = {
        name: salt,
        enableAutoFlush: true,
        masterAddress: "0x606bCAE4De681E6145817FB6267636E6795Eec80",
      };

      let result = await walletSdk.deployAddress(deployAddressParam);

      // Save and return the new wallet
      const wallet = new Wallet();
      wallet.userId = userId;
      wallet.type = WalletType.CHILD;
      wallet.walletAddress = result;
      wallet.cryptoNetworkId = cryptoCurrency.cryptoNetworkId;
      await wallet.useTransaction(trx).save();
      return wallet;
    });
  }

  // /**
  //  * Terminates or marks a wallet as reusable if the session has expired and no asset was received.
  //  * sessionDurationMinutes: how long a session lasts (default 60 min if not found in settings)
  //  * Adds 1 hour grace period as per requirements.
  //  */
  // public async terminateOrReuseWallet(walletId: number, sessionDurationMinutes: number = 60): Promise<boolean> {
  //   const wallet = await Wallet.findOrFail(walletId)
  //   const paymentIntent = await PaymentIntent.findOrFail(wallet.paymentIntentId)
  //   // Calculate expiry: createdAt + sessionDuration + 1hr
  //   const expiry = paymentIntent.createdAt.plus({ minutes: sessionDurationMinutes + 60 })
  //   if (DateTime.now() > expiry && wallet.status === WalletStatus.IN_PROGRESS) {
  //     // No asset received, mark wallet as reusable (set status to FAILED)
  //     wallet.status = WalletStatus.FAILED
  //     await wallet.save()
  //     return true
  //   }
  //   return false
  // }

  // /**
  //  * Flushes all assets from child wallets to the parent wallet after 24 hours.
  //  * This should be run as a scheduled job.
  //  * (Blockchain transfer logic should be implemented where indicated.)
  //  */
  // public async flushToParentWallet(): Promise<void> {
  //   // Find all wallets that are 24+ hours old and still have assets (status IN_PROGRESS or COMPLETED)
  //   const threshold = DateTime.now().minus({ hours: 24 })
  //   const wallets = await Wallet.query()
  //     .where('created_at', '<', threshold.toSQL())
  //     .whereIn('status', [WalletStatus.IN_PROGRESS, WalletStatus.COMPLETED])
  //   for (const wallet of wallets) {
  //     // TODO: Implement blockchain transfer logic here
  //     // Example: await blockchainService.transferToParent(wallet.walletAddress, parentWalletAddress)
  //     // After successful transfer, mark wallet as COMPLETED
  //     wallet.status = WalletStatus.COMPLETED
  //     await wallet.save()
  //   }
  // }
}

export default new WalletService()

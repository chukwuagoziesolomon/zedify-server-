import Wallet from 'App/Models/Wallet'
import PaymentIntent from 'App/Models/PaymentIntent'
import { PaymentIntentStatus, WalletType } from '../Lib/types'
import Currency from 'App/Models/Currency'
import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import WalletSDK from 'contract-wallet-sdk/dist/walletsdk'
import type { EvmChain } from 'contract-wallet-sdk/dist/walletsdk/types/types'
import CKBService from './CKBService'
import Logger from '@ioc:Adonis/Core/Logger'

import { DateTime } from 'luxon'

interface CreateChildWalletParams {
  userId: string;
  cryptoCurrencyId: string;
  refId?: string; // e.g., payment-intent-id or business ref-id
  sessionDurationMinutes?: number; // optional, default 60
}

const OWNER_EVM_PRIVATE_KEY = Env.get('OWNER_EVM_PRIVATE_KEY', '')
const MASTER_EVM_ADDRESS = Env.get('MASTER_EVM_ADDRESS', '')

class WalletService {
  /**
   * Create or reuse a wallet for a business/payment intent.
   * Prevents race conditions using a transaction and row-level lock.
   */
  public async createChildWallet({ userId, cryptoCurrencyId, refId, sessionDurationMinutes = 60 }: CreateChildWalletParams): Promise<Wallet> {
    return await Database.transaction(async (trx) => {
      const cryptoCurrency = await Currency.query({ client: trx })
        .where('uniqueId', cryptoCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail();

      const cryptoNetwork = cryptoCurrency.cryptoNetwork;

      if (cryptoNetwork.networkType === 'ckb') {
        return await this.createCkbWallet({ userId, cryptoCurrencyId, refId, sessionDurationMinutes, trx })
      }

      if (cryptoNetwork.networkType !== 'evm') {
        throw new Error(
          `Network ${cryptoNetwork.name} (${cryptoNetwork.networkType}) is not supported yet.`
        )
      }

      // Calculate expiration time (session + 1hr)
      const expiresAt = DateTime.now().plus({ minutes: sessionDurationMinutes + 60 });


      // Ensure only one active wallet per business/network/refId at a time
      // If there is an active wallet for this business/network (not expired), deploy a new one for concurrent transactions
      let activeWallet: Wallet | null = null;
      activeWallet = await Wallet.query({ client: trx })
        .where('userId', userId)
        .andWhere('cryptoNetworkId', cryptoCurrency.cryptoNetworkId)
        .andWhere('status', 'active')
        .andWhere('expiresAt', '>', DateTime.now().toSQL())
        .first();

      // If an active wallet exists, and refId is different or not set, deploy a new wallet
      if (activeWallet) {
        if (!refId || !activeWallet.refId || activeWallet.refId !== refId) {
          // Deploy new wallet for concurrent transaction
          // (skip reuse logic)
        } else if (activeWallet.reusable) {
          // If the wallet is marked reusable and refId matches, reuse it
          activeWallet.reusable = false;
          activeWallet.expiresAt = expiresAt;
          activeWallet.status = 'active';
          await activeWallet.useTransaction(trx).save();
          return activeWallet;
        } else {
          // If the wallet is not reusable, deploy a new one
        }
      } else if (refId) {
        // If no active wallet, check for a reusable wallet with this refId
        const reusableWallet = await Wallet.query({ client: trx })
          .where('userId', userId)
          .andWhere('cryptoNetworkId', cryptoCurrency.cryptoNetworkId)
          .andWhere('refId', refId)
          .andWhere('reusable', true)
          .andWhere(qb => {
            qb.whereNull('expiresAt').orWhere('expiresAt', '<', DateTime.now().toSQL());
          })
          .first();
        if (reusableWallet) {
          reusableWallet.reusable = false;
          reusableWallet.expiresAt = expiresAt;
          reusableWallet.status = 'active';
          await reusableWallet.useTransaction(trx).save();
          return reusableWallet;
        }
      }

      // Find all wallets for this user/business on this network, lock them for update
      const wallets = await Wallet.query({ client: trx })
        .where('userId', userId)
        .andWhere('cryptoNetworkId', cryptoCurrency.cryptoNetworkId)
        .forUpdate();

      // Try to find a wallet with a completed payment (legacy logic)
      for (const wallet of wallets) {
        const completedIntent = await PaymentIntent.query({ client: trx })
          .where('walletId', wallet.uniqueId)
          .andWhere('status', PaymentIntentStatus.PAYMENT_COMPLETED)
          .first();
        if (completedIntent) return wallet;
      }

      // Deploy new wallet
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
        masterAddress: MASTER_EVM_ADDRESS,
      };

      let result = await walletSdk.deployAddress(deployAddressParam);

      // Save and return the new wallet
      const wallet = new Wallet();
      wallet.userId = userId;
      wallet.type = WalletType.CHILD;
      wallet.walletAddress = result;
      wallet.cryptoNetworkId = cryptoCurrency.cryptoNetworkId;
      wallet.refId = refId;
      wallet.expiresAt = expiresAt;
      wallet.reusable = false;
      wallet.status = 'active';
      await wallet.useTransaction(trx).save();
      return wallet;
    });
  }

  private async createCkbWallet({ userId, cryptoCurrencyId, refId, sessionDurationMinutes = 60 }: {
    userId: string
    cryptoCurrencyId: string
    refId?: string
    sessionDurationMinutes?: number
  } & Record<string, any>): Promise<Wallet> {
    return await Database.transaction(async (trx) => {
      const cryptoCurrency = await Currency.query({ client: trx })
        .where('uniqueId', cryptoCurrencyId)
        .preload('cryptoNetwork')
        .firstOrFail()

      const expiresAt = DateTime.now().plus({ minutes: sessionDurationMinutes + 60 })
      const cryptoNetwork = cryptoCurrency.cryptoNetwork

      let activeWallet: Wallet | null = null
      if (refId) {
        activeWallet = await Wallet.query({ client: trx })
          .where('userId', userId)
          .andWhere('cryptoNetworkId', cryptoNetwork.uniqueId)
          .andWhere('refId', refId)
          .andWhere('status', 'active')
          .andWhere('expiresAt', '>', DateTime.now().toSQL())
          .first()
      }

      if (activeWallet && activeWallet.reusable) {
        activeWallet.reusable = false
        activeWallet.expiresAt = expiresAt
        activeWallet.status = 'active'
        await activeWallet.useTransaction(trx).save()
        return activeWallet
      }

      let ckbAddress: string | undefined
      try {
        await CKBService.initialize()
        ckbAddress = CKBService.generateWallet().address
      } catch (error) {
        Logger.warn('[WalletService] CKB wallet generation failed, using placeholder: %s', error.message)
      }

      const wallet = new Wallet()
      wallet.userId = userId
      wallet.type = WalletType.CHILD
      wallet.walletAddress = ckbAddress || `placeholder-ckb-${Date.now()}`
      wallet.cryptoNetworkId = cryptoNetwork.uniqueId
      wallet.refId = refId
      wallet.expiresAt = expiresAt
      wallet.reusable = false
      wallet.status = 'active'
      await wallet.useTransaction(trx).save()
      return wallet
    })
  }

  /**
   * Terminates or marks a wallet as reusable if the session has expired and no asset was received.
   * sessionDurationMinutes: how long a session lasts (default 60 min if not found in settings)
   * Adds 1 hour grace period as per requirements.
   */
  public async terminateOrReuseWallet(walletId: number, sessionDurationMinutes: number = 60): Promise<boolean> {
    const wallet = await Wallet.findOrFail(walletId);
    // Calculate expiry: createdAt + sessionDuration + 1hr
    const expiry = (wallet.expiresAt) ? wallet.expiresAt : wallet.createdAt.plus({ minutes: sessionDurationMinutes + 60 });
    if (DateTime.now() > expiry && wallet.status === 'active') {
      // No asset received, mark wallet as reusable
      wallet.status = 'expired';
      wallet.reusable = true;
      await wallet.save();
      return true;
    }
    return false;
  }

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

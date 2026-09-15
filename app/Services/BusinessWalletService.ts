import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'
import Currency from 'App/Models/Currency'
import UserWallet from 'App/Models/UserWallet'
import CKBService from './CKBService'
import WalletKeyEncryptionService from './WalletKeyEncryptionService'

class BusinessWalletService {
  public async provisionCkbWallet(userId: number, currencyId: string): Promise<UserWallet> {
    const currency = await Currency.query().where('uniqueId', currencyId).preload('cryptoNetwork').firstOrFail()
    const network = currency.cryptoNetwork

    if (currency.type !== 'CRYPTO' || network.networkType !== 'ckb') {
      throw new Error('Business wallet provisioning currently supports CKB currencies only')
    }

    const configuredNetwork = Env.get('CKB_NETWORK', 'mainnet')
    const expectedTestnet = configuredNetwork === 'testnet'
    if (Boolean(network.isTestnet) !== expectedTestnet) {
      throw new Error(`CKB network mismatch. Backend is configured for ${configuredNetwork}`)
    }

    return Database.transaction(async (trx) => {
      const existing = await UserWallet.query({ client: trx })
        .where('userId', userId)
        .where('cryptoNetworkId', network.uniqueId)
        .where('status', 'active')
        .first()
      if (existing) return existing

      await CKBService.initialize()
      const generated = CKBService.generateWallet()
      const encrypted = WalletKeyEncryptionService.encrypt(generated.privateKey)

      return UserWallet.create({
        userId,
        cryptoNetworkId: network.uniqueId,
        currencyId: currency.uniqueId,
        walletAddress: generated.address,
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        status: 'active',
        encryptedPrivateKey: encrypted.encryptedValue,
        keyVersion: encrypted.keyVersion,
        custodyStatus: 'custodial',
      }, { client: trx })
    })
  }
}

export default new BusinessWalletService()
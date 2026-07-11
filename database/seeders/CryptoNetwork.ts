import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Env from '@ioc:Adonis/Core/Env'
import { EvmChain } from 'contract-wallet-sdk/dist/walletsdk/types/types';

export default class extends BaseSeeder {
  public async run() {
    let network = await CryptoNetwork.query()
    if (network.length > 0) return;

    // Mainnet Networks
    await CryptoNetwork.createMany([
      {
        name: 'Binance Smart Chain',
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        rpcUrl: Env.get('BSC_RPC', 'https://bsc-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.BSC,
      },
      {
        name: 'Base',
        logo: 'https://cryptologos.cc/logos/base-base-logo.png',
        rpcUrl: Env.get('BASE_RPC', 'https://base-mainnet.g.alchemy.com/v2/c_cu-bh36G7AK-CB_kUJBo8sD_Dg1_aU'),
        isTestnet: false,
        chainKey: EvmChain.BASE,
      },
    ])

    // Testnet Networks
    await CryptoNetwork.createMany([
      {
        name: 'Ethereum Sepolia Testnet',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        rpcUrl: Env.get('SEPOLIA_RPC', 'https://shape-mainnet.g.alchemy.com/v2/c_cu-bh36G7AK-CB_kUJBo8sD_Dg1_aU'),
        isTestnet: true,
        chainKey: EvmChain.ETHEREUM, // For testnet, you may want to distinguish further
      },
      {
        name: 'AssetChain Testnet',
        logo: 'https://cryptologos.cc/logos/assetchain-assetchain-logo.png',
        rpcUrl: Env.get('ASSETCHAIN_TESTNET_RPC', 'https://fireblocksrpc-testnet.assetchain.org'),
        isTestnet: true,
        chainKey: 'assetchain', // Custom or future SDK mapping
      },
      {
        name: 'Base Sepolia Testnet',
        logo: 'https://cryptologos.cc/logos/base-base-logo.png',
        rpcUrl: Env.get('BASE_SEPOLIA_RPC', 'https://base-sepolia-rpc.publicnode.com'),
        isTestnet: true,
        chainKey: EvmChain.BASE, // For testnet, you may want to distinguish further
      },
      {
        name: 'Local Network',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        rpcUrl: 'http://127.0.0.1:8545/',
        isTestnet: true,
        chainKey: 'local', // Custom or future SDK mapping
      },
      {
        name: 'Nervos CKB Testnet',
        logo: 'https://cryptologos.cc/logos/nervos-network-ckb-logo.png',
        rpcUrl: Env.get('CKB_TESTNET_RPC', 'https://testnet.ckb.dev/rpc'),
        isTestnet: true,
        chainKey: 'ckb', // Non-EVM chain
      },
    ])

    console.log('✅ CryptoNetwork seeder completed')
  }
}

import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Env from '@ioc:Adonis/Core/Env'
import { EvmChain } from 'contract-wallet-sdk/dist/walletsdk/types/types';

export default class extends BaseSeeder {
  public async run() {
    let network = await CryptoNetwork.query()
    if (network.length > 0) return;

    // -------------------------------------------------------------------------
    // Mainnet EVM Networks
    // -------------------------------------------------------------------------
    await CryptoNetwork.createMany([
      {
        name: 'Binance Smart Chain',
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        rpcUrl: Env.get('BSC_RPC', 'https://bsc-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.BSC,
        networkType: 'evm',
        chainId: 56,
      },
      {
        name: 'Base',
        logo: 'https://cryptologos.cc/logos/base-base-logo.png',
        rpcUrl: Env.get('BASE_RPC', 'https://base-mainnet.g.alchemy.com/v2/c_cu-bh36G7AK-CB_kUJBo8sD_Dg1_aU'),
        isTestnet: false,
        chainKey: EvmChain.BASE,
        networkType: 'evm',
        chainId: 8453,
      },
      {
        name: 'Polygon',
        logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
        rpcUrl: Env.get('POLYGON_RPC', 'https://polygon-bor-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.POLYGON,
        networkType: 'evm',
        chainId: 137,
      },
      {
        name: 'Optimism',
        logo: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
        rpcUrl: Env.get('OPTIMISM_RPC', 'https://optimism-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.OPTIMISM,
        networkType: 'evm',
        chainId: 10,
      },
      {
        name: 'Arbitrum One',
        logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
        rpcUrl: Env.get('ARBITRUM_RPC', 'https://arbitrum-one-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.ARBITRUM,
        networkType: 'evm',
        chainId: 42161,
      },
      {
        name: 'Ethereum',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        rpcUrl: Env.get('ETHEREUM_RPC', 'https://ethereum-rpc.publicnode.com'),
        isTestnet: false,
        chainKey: EvmChain.ETHEREUM,
        networkType: 'evm',
        chainId: 1,
      },
    ])

    // -------------------------------------------------------------------------
    // Testnet EVM Networks
    // -------------------------------------------------------------------------
    await CryptoNetwork.createMany([
      {
        name: 'Ethereum Sepolia Testnet',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        rpcUrl: Env.get('SEPOLIA_RPC', 'https://ethereum-sepolia-rpc.publicnode.com'),
        isTestnet: true,
        chainKey: EvmChain.ETHEREUM,
        networkType: 'evm',
        chainId: 11155111,
      },
      {
        name: 'AssetChain Testnet',
        logo: 'https://cryptologos.cc/logos/assetchain-assetchain-logo.png',
        rpcUrl: Env.get('ASSETCHAIN_TESTNET_RPC', 'https://fireblocksrpc-testnet.assetchain.org'),
        isTestnet: true,
        chainKey: 'assetchain',
        networkType: 'evm',
        chainId: null,
      },
      {
        name: 'Base Sepolia Testnet',
        logo: 'https://cryptologos.cc/logos/base-base-logo.png',
        rpcUrl: Env.get('BASE_SEPOLIA_RPC', 'https://base-sepolia-rpc.publicnode.com'),
        isTestnet: true,
        chainKey: EvmChain.BASE,
        networkType: 'evm',
        chainId: 84532,
      },
      {
        name: 'Polygon Mumbai Testnet',
        logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
        rpcUrl: Env.get('POLYGON_MUMBAI_RPC', 'https://rpc-mumbai.maticvigil.com'),
        isTestnet: true,
        chainKey: EvmChain.POLYGON,
        networkType: 'evm',
        chainId: 80001,
      },
      {
        name: 'Local Network',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        rpcUrl: 'http://127.0.0.1:8545/',
        isTestnet: true,
        chainKey: 'local',
        networkType: 'evm',
        chainId: 1337,
      },
      // -----------------------------------------------------------------------
      // Non-EVM Networks
      // -----------------------------------------------------------------------
      {
        name: 'Nervos CKB Mainnet',
        logo: 'https://cryptologos.cc/logos/nervos-network-ckb-logo.png',
        rpcUrl: Env.get('CKB_MAINNET_RPC', 'https://mainnet.ckb.dev/rpc'),
        isTestnet: false,
        chainKey: 'ckb',
        networkType: 'ckb',
        chainId: null,
      },
      {
        name: 'Nervos CKB Testnet',
        logo: 'https://cryptologos.cc/logos/nervos-network-ckb-logo.png',
        rpcUrl: Env.get('CKB_TESTNET_RPC', 'https://testnet.ckb.dev/rpc'),
        isTestnet: true,
        chainKey: 'ckb',
        networkType: 'ckb',
        chainId: null,
      },
      {
        name: 'Fiber Mainnet',
        logo: 'https://cryptologos.cc/logos/nervos-network-ckb-logo.png',
        rpcUrl: Env.get('FIBER_NODE_URL', 'http://127.0.0.1:8227'),
        isTestnet: false,
        chainKey: 'fiber-mainnet',
        networkType: 'ckb',
        chainId: null,
      },
      {
        name: 'Fiber Testnet',
        logo: 'https://cryptologos.cc/logos/nervos-network-ckb-logo.png',
        rpcUrl: Env.get('FIBER_NODE_URL', 'http://127.0.0.1:8227'),
        isTestnet: true,
        chainKey: 'fiber-testnet',
        networkType: 'ckb',
        chainId: null,
      },
      {
        name: 'Solana',
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
        rpcUrl: Env.get('SOLANA_RPC', 'https://api.devnet.solana.com'),
        isTestnet: true,
        chainKey: 'solana',
        networkType: 'solana',
        chainId: null,
      },
      {
        name: 'Tron',
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png',
        rpcUrl: Env.get('TRON_RPC', 'https://api.trongrid.io'),
        isTestnet: false,
        chainKey: 'tron',
        networkType: 'tron',
        chainId: null,
      },
    ])

    console.log('✅ CryptoNetwork seeder completed')
  }
}

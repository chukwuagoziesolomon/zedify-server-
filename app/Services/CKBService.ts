import { hd, config, helpers, BI, Indexer, RPC } from '@ckb-lumos/lumos'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import Logger from '@ioc:Adonis/Core/Logger'
import crypto from 'crypto'

class CKBServiceClass {
  private rpcUrl: string = 'https://testnet.ckb.dev/rpc'
  private indexerUrl: string = 'https://testnet.ckb.dev/indexer'
  private networkConfig: any = config.predefined.AGGRON4
  private initialized: boolean = false

    /**
     * Initialize with RPC URL from database or fallback to testnet
     */
    public async initialize() {
      if (this.initialized) return

      try {
        const network = await CryptoNetwork.query().where('chainKey', 'ckb').first()
        if (network) {
          this.rpcUrl = network.rpcUrl
          this.indexerUrl = network.rpcUrl.replace('/rpc', '/indexer')
          this.networkConfig = config.predefined.AGGRON4
        }
        this.initialized = true
        Logger.info('CKBService initialized with RPC: %s (network: testnet)', this.rpcUrl)
      } catch (error) {
        Logger.warn('CKBService: Could not load network from DB, using testnet defaults')
        this.networkConfig = config.predefined.AGGRON4
        this.initialized = true
      }
  }

  /**
   * Generate a CKB address from a private key
   * Uses the configured network (mainnet or testnet)
   */
  public generateAddress(privateKey: string): string {
    const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
    const args = hd.key.privateKeyToBlake160(normalizedPrivateKey)
    const template = this.networkConfig.SCRIPTS.SECP256K1_BLAKE160!
    const lockScript = {
      codeHash: template.CODE_HASH,
      hashType: template.HASH_TYPE,
      args: args,
    }
    return helpers.encodeToAddress(lockScript, { config: this.networkConfig })
  }

  /**
   * Generate a new random private key and its corresponding CKB address
   */
  public generateWallet(): { privateKey: string; address: string } {
    try {
      const privateKey = '0x' + crypto.randomBytes(32).toString('hex')
      const address = this.generateAddress(privateKey)
      return { privateKey, address }
    } catch (error) {
      Logger.error('[CKBService] Failed to generate wallet: %s', error.message)
      throw new Error(`privateKey must be a hex string!`)
    }
  }

  /**
   * Get CKB balance for an address (in CKB, not Shannon)
   * 1 CKB = 10^8 Shannon
   */
  public async getBalance(address: string): Promise<{ balanceCkb: string; balanceShannon: string }> {
    await this.initialize()

    const indexer = new Indexer(this.indexerUrl, this.rpcUrl)
    const lockScript = helpers.parseAddress(address, { config: this.networkConfig })

    const collector = indexer.collector({ lock: lockScript })

    let balance = BI.from(0)
    for await (const cell of collector.collect()) {
      balance = balance.add(cell.cellOutput.capacity)
    }

    return {
      balanceShannon: balance.toString(),
      balanceCkb: (Number(balance.toString()) / 1e8).toFixed(8),
    }
  }

  /**
   * Get chain tip block number and node info
   */
  public async getChainInfo(): Promise<{ tipBlockNumber: string; nodeInfo: any }> {
    await this.initialize()

    const rpc = new RPC(this.rpcUrl)
    const tipHeader = await rpc.getTipHeader()
    const nodeInfo = await rpc.localNodeInfo()

    return {
      tipBlockNumber: BI.from(tipHeader.number).toString(),
      nodeInfo: {
        version: nodeInfo.version,
        nodeId: nodeInfo.nodeId,
      },
    }
  }

  /**
   * Get transaction details by hash
   */
  public async getTransaction(txHash: string): Promise<any> {
    await this.initialize()
    const rpc = new RPC(this.rpcUrl)
    return await rpc.getTransaction(txHash)
  }

  /**
   * Get block by number
   */
  public async getBlock(blockNumber: string): Promise<any> {
    await this.initialize()
    const rpc = new RPC(this.rpcUrl)
    const hexBlockNumber = '0x' + BigInt(blockNumber).toString(16)
    return await rpc.getBlockByNumber(hexBlockNumber)
  }
}

export default new CKBServiceClass()

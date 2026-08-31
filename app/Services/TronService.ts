import Logger from '@ioc:Adonis/Core/Logger'

export interface TronWallet {
  privateKey: string
  address: string
}

export interface TronBalance {
  raw: string
  formatted: string
  decimals: number
}

class TronServiceClass {
  private rpcUrl: string = 'https://api.trongrid.io'
  private initialized: boolean = false
  private tronWeb: any = null

  public async initialize(rpcUrl?: string) {
    if (this.initialized) return
    if (rpcUrl) this.rpcUrl = rpcUrl
    const TronWebModule = (await import('tronweb')).default as any
    this.tronWeb = new TronWebModule({ fullHost: this.rpcUrl })
    this.initialized = true
    Logger.info('[TronService] Initialized with RPC: %s', this.rpcUrl)
  }

  public generateWallet(): TronWallet {
    const TronWebModule = require('tronweb').default as any
    const tronWeb = new TronWebModule({ fullHost: this.rpcUrl })
    const wallet = tronWeb.createAccount()
    return {
      privateKey: wallet.privateKey,
      address: wallet.address.base58,
    }
  }

  public async getBalance(address: string): Promise<TronBalance> {
    await this.initialize()
    if (!this.tronWeb) throw new Error('TronService not initialized')

    const balanceSun = await this.tronWeb.trx.getBalance(address)
    const balanceTrx = balanceSun / 1_000_000
    return {
      raw: String(balanceSun),
      formatted: balanceTrx.toFixed(6),
      decimals: 6,
    }
  }

  public async getTrc20Balance(
    address: string,
    contractAddress: string
  ): Promise<TronBalance> {
    await this.initialize()
    if (!this.tronWeb) throw new Error('TronService not initialized')

    const contract = await this.tronWeb.contract().at(contractAddress)
    const decimals = await contract.decimals().call()
    const balance = await contract.balanceOf(address).call()

    const formatted = Number(balance) / Math.pow(10, Number(decimals))
    return {
      raw: String(balance),
      formatted: formatted.toFixed(Number(decimals)),
      decimals: Number(decimals),
    }
  }

  public async verifyTransaction(
    txHash: string,
    toAddress: string,
    expectedAmount: number,
    contractAddress?: string
  ): Promise<{ verified: boolean; receivedAmount: string }> {
    await this.initialize()
    if (!this.tronWeb) throw new Error('TronService not initialized')

    try {
      const tx = await this.tronWeb.trx.getTransactionInfo(txHash)
      if (!tx || tx.result !== true) {
        return { verified: false, receivedAmount: '0' }
      }

      if (contractAddress) {
        const receipt = await this.tronWeb.trx.getTransaction(txHash)
        if (receipt && receipt.logs && receipt.logs.length > 0) {
          const transferLog = receipt.logs.find(
            (log: any) =>
              log.topics &&
              log.topics[0] ===
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
          )
          if (transferLog) {
            const received = Number(transferLog.data) / 1_000_000
            const verified = received >= expectedAmount * 0.99
            return { verified, receivedAmount: received.toFixed(6) }
          }
        }
        return { verified: false, receivedAmount: '0' }
      } else {
        const balanceAfter = await this.tronWeb.trx.getBalance(toAddress)
        const received = balanceAfter / 1_000_000
        const verified = received >= expectedAmount * 0.99
        return { verified, receivedAmount: received.toFixed(6) }
      }
    } catch (error) {
      Logger.warn('[TronService] Failed to verify tx %s: %s', txHash, error.message)
      return { verified: false, receivedAmount: '0' }
    }
  }
}

export default new TronServiceClass()

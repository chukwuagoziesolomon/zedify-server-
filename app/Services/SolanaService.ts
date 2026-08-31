import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import Logger from '@ioc:Adonis/Core/Logger'

export interface SolanaWallet {
  privateKey: string
  address: string
}

export interface SolanaBalance {
  raw: number
  formatted: string
  decimals: number
}

class SolanaServiceClass {
  private rpcUrl: string = 'https://api.devnet.solana.com'
  private initialized: boolean = false

  public async initialize(rpcUrl?: string) {
    if (this.initialized) return
    if (rpcUrl) this.rpcUrl = rpcUrl
    this.initialized = true
    Logger.info('[SolanaService] Initialized with RPC: %s', this.rpcUrl)
  }

  public generateWallet(): SolanaWallet {
    const keypair = Keypair.generate()
    return {
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      address: keypair.publicKey.toBase58(),
    }
  }

  public async getBalance(address: string): Promise<SolanaBalance> {
    await this.initialize()
    const connection = new Connection(this.rpcUrl, 'confirmed')
    const pubkey = new PublicKey(address)
    const lamports = await connection.getBalance(pubkey)
    return {
      raw: lamports,
      formatted: (lamports / LAMPORTS_PER_SOL).toFixed(9),
      decimals: 9,
    }
  }

  public async getTokenBalance(
    address: string,
    mintAddress: string
  ): Promise<SolanaBalance> {
    await this.initialize()
    const connection = new Connection(this.rpcUrl, 'confirmed')
    const pubkey = new PublicKey(address)
    const mint = new PublicKey(mintAddress)

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      mint,
    })

    if (tokenAccounts.value.length === 0) {
      return { raw: 0, formatted: '0', decimals: 0 }
    }

    const account = tokenAccounts.value[0]
    const info = account.account.data.parsed.info
    const balance = Number(info.tokenAmount.uiAmount)
    const decimals = info.tokenAmount.decimals
    const raw = Number(info.tokenAmount.amount)

    return {
      raw,
      formatted: balance.toFixed(decimals),
      decimals,
    }
  }

  public async verifyTransaction(
    signature: string,
    toAddress: string,
    expectedAmount: number,
    mintAddress?: string
  ): Promise<{ verified: boolean; receivedAmount: string }> {
    await this.initialize()
    const connection = new Connection(this.rpcUrl, 'confirmed')

    try {
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      })

      if (!tx || tx.meta?.err) {
        return { verified: false, receivedAmount: '0' }
      }

      const toPubkey = new PublicKey(toAddress)

      if (mintAddress) {
        const mint = new PublicKey(mintAddress)
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(toPubkey, {
          mint,
        })

        if (tokenAccounts.value.length === 0) {
          return { verified: false, receivedAmount: '0' }
        }

        const preBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
        const received = preBalance
        const verified = Number(received) >= expectedAmount * 0.99
        return { verified, receivedAmount: String(received) }
      } else {
        const preBalance = await connection.getBalance(toPubkey)
        const accountIndex = tx.transaction.message.staticAccountKeys.findIndex(
          (k) => k.toBase58() === toPubkey.toBase58()
        )
        const postBalance = accountIndex >= 0 ? (tx.meta?.postBalances?.[accountIndex] ?? preBalance) : preBalance

        const receivedSol = (postBalance - preBalance) / LAMPORTS_PER_SOL
        const verified = receivedSol >= expectedAmount * 0.99
        return { verified, receivedAmount: receivedSol.toFixed(9) }
      }
    } catch (error) {
      Logger.warn('[SolanaService] Failed to verify tx %s: %s', signature, error.message)
      return { verified: false, receivedAmount: '0' }
    }
  }
}

export default new SolanaServiceClass()

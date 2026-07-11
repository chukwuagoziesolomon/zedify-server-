import { ethers } from 'ethers'
import Logger from '@ioc:Adonis/Core/Logger'

// Minimal ERC-20 ABI — only the functions we need
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

export interface EVMBalanceResult {
  /** Raw balance as bigint (in smallest unit, e.g. wei or token units) */
  raw: bigint
  /** Human-readable balance string (formatted with correct decimals) */
  formatted: string
  /** Number of decimals used for formatting */
  decimals: number
}

class EVMServiceClass {
  /**
   * Get native token balance (ETH / BNB / MATIC / etc.) for an address.
   */
  public async getNativeBalance(address: string, rpcUrl: string): Promise<EVMBalanceResult> {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const raw = await provider.getBalance(address)
    return {
      raw,
      formatted: ethers.formatEther(raw),
      decimals: 18,
    }
  }

  /**
   * Get ERC-20 token balance for an address.
   * Automatically reads the token's decimals from the contract.
   */
  public async getERC20Balance(
    address: string,
    contractAddress: string,
    rpcUrl: string
  ): Promise<EVMBalanceResult> {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)

    const [raw, decimals]: [bigint, number] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
    ])

    return {
      raw,
      formatted: ethers.formatUnits(raw, decimals),
      decimals,
    }
  }

  /**
   * Get the balance for a given address and optional ERC-20 contract.
   * If contractAddress is null/undefined, falls back to native token balance.
   */
  public async getBalance(
    address: string,
    rpcUrl: string,
    contractAddress?: string | null
  ): Promise<EVMBalanceResult> {
    if (contractAddress) {
      return this.getERC20Balance(address, contractAddress, rpcUrl)
    }
    return this.getNativeBalance(address, rpcUrl)
  }

  /**
   * Verify that a transaction exists on-chain and transferred at least `expectedAmount`
   * to `toAddress`. Supports both native transfers and ERC-20 Transfer events.
   *
   * Returns null if the transaction cannot be verified.
   */
  public async verifyTransaction(params: {
    txHash: string
    toAddress: string
    expectedAmount: number
    rpcUrl: string
    contractAddress?: string | null
  }): Promise<{ verified: boolean; receivedAmount: string }> {
    const { txHash, toAddress, expectedAmount, rpcUrl, contractAddress } = params
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    try {
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt || receipt.status !== 1) {
        return { verified: false, receivedAmount: '0' }
      }

      if (contractAddress) {
        // ERC-20: look for a Transfer event to toAddress
        const iface = new ethers.Interface(ERC20_ABI)
        let totalReceived = 0n
        let decimals = 18

        // Try to get decimals from contract
        try {
          const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
          decimals = await contract.decimals()
        } catch {
          // fallback to 18
        }

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
          try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
            if (
              parsed?.name === 'Transfer' &&
              parsed.args.to.toLowerCase() === toAddress.toLowerCase()
            ) {
              totalReceived += parsed.args.value as bigint
            }
          } catch {
            // Not a Transfer event from this contract
          }
        }

        const formatted = ethers.formatUnits(totalReceived, decimals)
        const verified = parseFloat(formatted) >= expectedAmount * 0.99
        return { verified, receivedAmount: formatted }
      } else {
        // Native token: check the transaction value
        const tx = await provider.getTransaction(txHash)
        if (!tx) return { verified: false, receivedAmount: '0' }

        const receivedAmount = ethers.formatEther(tx.value)
        const verified = parseFloat(receivedAmount) >= expectedAmount * 0.99
        return { verified, receivedAmount }
      }
    } catch (error) {
      Logger.warn(`[EVMService] Failed to verify tx ${txHash}: ${error}`)
      return { verified: false, receivedAmount: '0' }
    }
  }

  /**
   * Resolve a provider for the given RPC URL.
   * Useful for callers that need raw provider access.
   */
  public getProvider(rpcUrl: string): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(rpcUrl)
  }
}

export default new EVMServiceClass()

import Logger from '@ioc:Adonis/Core/Logger'
import SudtRegistry from 'App/Models/SudtRegistry'
import ConversionService from './ConversionService'
import { v4 as uuid } from 'uuid'

export interface SudtTokenInfo {
  typeScript: string
  symbol: string
  name: string
  decimals: number
  logo: string
  network: string
  enabled: boolean
  priceInUsdt?: number
}

export interface SudtConversionResult {
  fromAmount: number
  fromSymbol: string
  toAmount: number
  toSymbol: string
  exchangeRate: number
  timestamp: string
}

class SudtServiceClass {
  /**
   * Register a new SUDT token globally
   */
  async registerSudtToken(data: {
    typeScript: string
    symbol: string
    name: string
    decimals?: number
    logo: string
    network: string
    issuer?: string
    website?: string
    totalSupply?: string
  }): Promise<SudtRegistry> {
    // Check if already exists
    const existing = await SudtRegistry.query()
      .where('typeScript', data.typeScript)
      .first()

    if (existing) {
      throw new Error(`SUDT token already registered: ${data.typeScript}`)
    }

    const token = await SudtRegistry.create({
      uniqueId: uuid(),
      typeScript: data.typeScript,
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals ?? 6,
      logo: data.logo,
      network: data.network,
      issuer: data.issuer,
      website: data.website,
      totalSupply: data.totalSupply,
      enabled: true,
    })

    Logger.info(
      `[SudtService] Registered SUDT token: ${data.symbol} (${data.typeScript})`
    )
    return token
  }

  /**
   * Get SUDT token by type script
   */
  async getSudtByTypeScript(typeScript: string): Promise<SudtRegistry | null> {
    return await SudtRegistry.query()
      .where('typeScript', typeScript)
      .where('enabled', true)
      .first()
  }

  /**
   * Get SUDT token by symbol
   */
  async getSudtBySymbol(symbol: string, network?: string): Promise<SudtRegistry | null> {
    let query = SudtRegistry.query()
      .where('symbol', symbol)
      .where('enabled', true)

    if (network) {
      query = query.where('network', network)
    }

    return await query.first()
  }

  /**
   * List all available SUDT tokens
   */
  async listAvailableSudtTokens(network?: string): Promise<SudtRegistry[]> {
    let query = SudtRegistry.query().where('enabled', true)

    if (network) {
      query = query.where('network', network)
    }

    return await query
  }

  /**
   * Convert SUDT amount to USDT
   * Uses current market price or oracle
   */
  async convertSudtToUsdt(
    sudtAmount: number,
    typeScript: string
  ): Promise<SudtConversionResult> {
    const sudtToken = await this.getSudtByTypeScript(typeScript)
    if (!sudtToken) {
      throw new Error(`SUDT token not found: ${typeScript}`)
    }

    // For now, get price from ConversionService
    // In future: integrate with Chainlink oracle or DEX
    let exchangeRate = 1

    // Hardcoded for testnet tokens
    if (sudtToken.symbol === 'USDC') {
      exchangeRate = 1.0 // USDC = 1 USD
    } else if (sudtToken.symbol === 'FIBB' || sudtToken.symbol === 'Fibt') {
      // Get CKB/USD rate, then apply Fiber token conversion
      const ckbToUsd = await ConversionService.convertCkbToUsd(1)
      exchangeRate = parseFloat(ckbToUsd.toFixed(6))
    } else {
      // Try to get price from external oracle
      Logger.warn(`[SudtService] No price feed for ${sudtToken.symbol}, using 1:1 ratio`)
      exchangeRate = 1.0
    }

    const usdtAmount = sudtAmount * exchangeRate

    return {
      fromAmount: sudtAmount,
      fromSymbol: sudtToken.symbol,
      toAmount: parseFloat(usdtAmount.toFixed(6)),
      toSymbol: 'USDT',
      exchangeRate,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Convert SUDT to another SUDT
   */
  async convertSudtToSudt(
    fromAmount: number,
    fromTypeScript: string,
    toTypeScript: string
  ): Promise<SudtConversionResult> {
    const fromToken = await this.getSudtByTypeScript(fromTypeScript)
    const toToken = await this.getSudtByTypeScript(toTypeScript)

    if (!fromToken || !toToken) {
      throw new Error('One or both SUDT tokens not found')
    }

    // Convert through USDT as intermediate
    const toUsdt = await this.convertSudtToUsdt(fromAmount, fromTypeScript)
    const fromUsdt = await this.convertSudtToUsdt(1, toTypeScript)

    const toAmount = toUsdt.toAmount / fromUsdt.exchangeRate

    return {
      fromAmount,
      fromSymbol: fromToken.symbol,
      toAmount: parseFloat(toAmount.toFixed(6)),
      toSymbol: toToken.symbol,
      exchangeRate: toAmount / fromAmount,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get price of SUDT token in USDT
   */
  async getSudtPrice(typeScript: string): Promise<number> {
    const result = await this.convertSudtToUsdt(1, typeScript)
    return result.exchangeRate
  }

  /**
   * Format SUDT amount with decimals
   */
  formatSudtAmount(amount: number, typeScript: string | SudtRegistry): string {
    let decimals = 6
    if (typeof typeScript === 'string') {
      // Would need to lookup, for now default to 6
      decimals = 6
    } else {
      decimals = typeScript.decimals
    }

    return (amount / Math.pow(10, decimals)).toFixed(decimals)
  }

  /**
   * Parse SUDT amount from formatted string
   */
  parseSudtAmount(formattedAmount: string, decimals: number = 6): number {
    return Math.floor(parseFloat(formattedAmount) * Math.pow(10, decimals))
  }

  /**
   * Enable/disable SUDT token globally
   */
  async setSudtTokenStatus(typeScript: string, enabled: boolean): Promise<void> {
    await SudtRegistry.query()
      .where('typeScript', typeScript)
      .update({ enabled })

    Logger.info(
      `[SudtService] SUDT ${typeScript} ${enabled ? 'enabled' : 'disabled'}`
    )
  }

  /**
   * Get popular SUDT tokens for UI dropdown
   */
  async getPopularSudtTokens(network: string = 'ckb-testnet'): Promise<SudtRegistry[]> {
    return await SudtRegistry.query()
      .where('network', network)
      .where('enabled', true)
      .orderBy('symbol', 'asc')
      .limit(20)
  }

  /**
   * Search SUDT tokens
   */
  async searchSudtTokens(query: string, network?: string): Promise<SudtRegistry[]> {
    let search = SudtRegistry.query()
      .where((q) => {
        q.where('symbol', 'like', `%${query}%`).orWhere('name', 'like', `%${query}%`)
      })
      .where('enabled', true)

    if (network) {
      search = search.where('network', network)
    }

    return await search.limit(10)
  }
}

export default new SudtServiceClass()

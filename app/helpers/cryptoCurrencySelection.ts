interface CryptoCurrencyLike {
  uniqueId: string
  symbol?: string
  name?: string
  type?: string
  cryptoNetworkId?: string
  cryptoNetwork?: {
    chainKey?: string
    networkType?: string
  }
}

const FIBER_CHAIN_KEYS = ['fiber-testnet', 'fiber-mainnet', 'fiber-devnet']

function getNetworkMeta(currency: CryptoCurrencyLike) {
  return {
    networkType: String(currency.cryptoNetwork?.networkType || '').toLowerCase(),
    chainKey: String(currency.cryptoNetwork?.chainKey || '').toLowerCase(),
  }
}

function isFiberCkbCurrency(currency: CryptoCurrencyLike): boolean {
  const { networkType, chainKey } = getNetworkMeta(currency)
  return networkType === 'ckb' && FIBER_CHAIN_KEYS.includes(chainKey)
}

export type PaymentFlowStrategy = 'fiber_invoice' | 'wallet'

export function resolvePaymentFlowStrategy(network?: { networkType?: string; chainKey?: string }): PaymentFlowStrategy {
  const networkType = String(network?.networkType || '').toLowerCase()
  const chainKey = String(network?.chainKey || '').toLowerCase()

  if (networkType === 'ckb' && FIBER_CHAIN_KEYS.includes(chainKey)) {
    return 'fiber_invoice'
  }

  return 'wallet'
}

export function resolvePreferredCryptoCurrency(
  currencies: CryptoCurrencyLike[],
  requestedSymbol?: string
): CryptoCurrencyLike | null {
  if (!currencies.length) return null

  const normalizedSymbol = requestedSymbol?.toUpperCase()

  if (normalizedSymbol) {
    const exactSymbolMatches = currencies.filter((currency) => currency.symbol?.toUpperCase() === normalizedSymbol)
    if (exactSymbolMatches.length) {
      if (normalizedSymbol === 'CKB') {
        const fiberMatch = exactSymbolMatches.find(isFiberCkbCurrency)
        if (fiberMatch) return fiberMatch
      }

      return exactSymbolMatches[0]
    }
  }

  const firstMatchingNetwork = currencies.find((currency) => {
    const { networkType } = getNetworkMeta(currency)
    return networkType !== 'ckb' || !isFiberCkbCurrency(currency)
  })

  return firstMatchingNetwork ?? currencies[0]
}

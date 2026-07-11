import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { FiberClient, FiberRpcError, FiberConnectionError } from 'fiber-rpc-js'
import PaymentChannel, { ChannelState } from 'App/Models/PaymentChannel'

export interface FiberNodeInfo {
  peerId: string
  version: string
  addresses: string[]
}

export interface FiberChannel {
  uniqueId: string
  channelId: string
  peerId: string
  localBalance: string
  remoteBalance: string
  localBalanceCKB: number
  remoteBalanceCKB: number
  state: string
  isPublic: boolean
  isOneWay: boolean
  currency: string
  channelOutpoint?: string
  createdAt: string
}

export interface FiberPayment {
  paymentHash: string
  status: string
  fee?: string
  feesCKB?: number
}

export interface FiberInvoice {
  invoiceAddress: string
  invoice: any
  status?: string
}

class FiberServiceClass {
  private readonly defaultTimeoutMs = 10000
  private clientCache: FiberClient | null = null
  private lastCacheKey: string = ''

  private get fiberNodeUrl(): string {
    return Env.get('FIBER_NODE_URL', 'http://127.0.0.1:8227')
  }

  private get fiberBiscuitToken(): string | undefined {
    const token = Env.get('FIBER_BISCUIT_TOKEN', '')
    return token ? token : undefined
  }

  private get fiberNetwork(): 'mainnet' | 'testnet' | 'devnet' {
    return (Env.get('FIBER_NETWORK', 'testnet') as 'mainnet' | 'testnet' | 'devnet')
  }

  private getClient(): FiberClient {
    if (!this.fiberNodeUrl) {
      throw new Error('Fiber node URL is not configured. Set FIBER_NODE_URL.')
    }

    const cacheKey = `${this.fiberNodeUrl}|${this.fiberBiscuitToken || ''}|${this.fiberNetwork}`
    if (this.clientCache && this.lastCacheKey === cacheKey) {
      return this.clientCache
    }

    this.clientCache = new FiberClient({
      url: this.fiberNodeUrl,
      biscuitToken: this.fiberBiscuitToken,
      network: this.fiberNetwork,
      timeoutMs: this.defaultTimeoutMs,
    })
    this.lastCacheKey = cacheKey
    return this.clientCache
  }

  private parseChannel(channelId: string, raw: any, currency: string): FiberChannel {
    return {
      uniqueId: channelId,
      channelId: raw.channel_id || channelId,
      peerId: raw.peer_id || '',
      localBalance: raw.local_balance?.toString?.() ?? String(raw.local_balance ?? 0),
      remoteBalance: raw.remote_balance?.toString?.() ?? String(raw.remote_balance ?? 0),
      localBalanceCKB: Number(raw.local_balance ?? 0) / 1e8,
      remoteBalanceCKB: Number(raw.remote_balance ?? 0) / 1e8,
      state: raw.state?.state_name ?? raw.state ?? 'open',
      isPublic: Boolean(raw.is_public ?? true),
      isOneWay: Boolean(raw.is_one_way ?? false),
      currency,
      channelOutpoint: raw.channel_outpoint,
      createdAt: raw.created_at ?? new Date().toISOString(),
    }
  }

  public async getNodeInfo(): Promise<FiberNodeInfo> {
    try {
      const info = await this.getClient().nodeInfo()
      return {
        peerId: info.peer_id ?? info.peerId ?? '',
        version: info.version ?? '',
        addresses: Array.isArray(info.addresses) ? info.addresses : [],
      }
    } catch (error: any) {
      Logger.error('[Fiber] Failed to fetch node info: %s', error.message)
      throw error
    }
  }

  public async listChannels(businessId: string, includeClosed = false): Promise<FiberChannel[]> {
    try {
      const { channels } = await this.getClient().listChannels({ includeClosed })

      const stored = await PaymentChannel.query().where('businessId', businessId)
      const storedMap = new Map(stored.map((ch) => [ch.channelId, ch]))

      const parsed = channels.map((raw: any) => this.parseChannel(raw.channel_id, raw, this.getCurrencySymbol()))
      return parsed.filter((ch) => storedMap.has(ch.channelId))
    } catch (error: any) {
      if (error instanceof FiberConnectionError) {
        Logger.warn('[Fiber] Node unreachable: %s', error.url)
      }
      throw error
    }
  }

  public async openChannel(businessId: string, peerId: string, fundingAmountCKB: number, isPublic = true, isOneWay = false): Promise<PaymentChannel> {
    try {
      const fundingAmountShannon = Math.floor(fundingAmountCKB * 1e8)
      const { temporaryChannelId } = await this.getClient().openChannel({
        peerId,
        fundingAmount: fundingAmountShannon,
        isPublic,
        isOneWay,
      })

      const channel = await PaymentChannel.create({
        businessId,
        channelId: temporaryChannelId,
        peerId,
        localBalance: `0x${fundingAmountShannon.toString(16)}`,
        remoteBalance: '0x0',
        currency: this.getCurrencySymbol(),
        state: ChannelState.PENDING,
        isPublic,
        isOneWay,
      })

      Logger.info('[Fiber] Channel opened: business=%s channel=%s peer=%s', businessId, temporaryChannelId, peerId)
      return channel
    } catch (error: any) {
      Logger.error('[Fiber] Failed to open channel: %s', error.message)
      throw error
    }
  }

  public async createInvoice(businessId: string, amountCKB: number, description = 'Payment for order', expirySeconds = 3600): Promise<FiberInvoice> {
    try {
      const amountShannon = Math.floor(amountCKB * 1e8)
      const { invoiceAddress, invoice } = await this.getClient().newInvoice({
        amount: amountShannon,
        description,
        currency: this.getCurrencySymbol(),
        expirySeconds,
      })

      await PaymentChannel.create({
        businessId,
        channelId: invoiceAddress,
        peerId: '',
        localBalance: `0x${amountShannon.toString(16)}`,
        remoteBalance: '0x0',
        currency: this.getCurrencySymbol(),
        state: ChannelState.PENDING,
        isPublic: false,
        isOneWay: true,
        metadata: { invoice, description, amountCKB, expirySeconds },
      })

      Logger.info('[Fiber] Invoice created: business=%s address=%s amount=%s CKB', businessId, invoiceAddress, amountCKB)
      return {
        invoiceAddress,
        invoice,
        status: 'pending',
      }
    } catch (error: any) {
      Logger.error('[Fiber] Failed to create invoice: %s', error.message)
      throw error
    }
  }

  public async sendPayment(invoice: string, maxFeeCKB?: number): Promise<FiberPayment> {
    try {
      const params: any = { invoice }
      if (maxFeeCKB !== undefined) {
        params.maxFeeAmount = Math.floor(maxFeeCKB * 1e8)
      }

      const result = await this.getClient().sendPayment(params)
      Logger.info('[Fiber] Payment sent: hash=%s status=%s', result.paymentHash, result.status)
      return result
    } catch (error: any) {
      if (error instanceof FiberRpcError) {
        Logger.error('[Fiber] RPC error sending payment: %s - %s', error.code, error.message)
      }
      throw error
    }
  }

  public async getPaymentStatus(paymentHash: string): Promise<FiberPayment | null> {
    try {
      const result = await this.getClient().getPayment(paymentHash)
      return result
    } catch (error: any) {
      if (error instanceof FiberRpcError && error.code === -32601) {
        return null
      }
      Logger.error('[Fiber] Failed to get payment status: %s', error.message)
      throw error
    }
  }

  public async getInvoice(paymentHash: string): Promise<FiberInvoice | null> {
    try {
      const result = await this.getClient().getInvoice(paymentHash)
      return {
        invoiceAddress: result.invoiceAddress,
        invoice: result.invoice,
        status: result.status,
      }
    } catch (error: any) {
      if (error instanceof FiberRpcError && error.code === -32601) {
        return null
      }
      Logger.error('[Fiber] Failed to get invoice: %s', error.message)
      throw error
    }
  }

  public async syncChannels(businessId: string): Promise<void> {
    try {
      const { channels } = await this.getClient().listChannels({ includeClosed: true })
      const stored = await PaymentChannel.query().where('businessId', businessId)
      const storedMap = new Map(stored.map((ch) => [ch.channelId, ch]))

      for (const raw of channels) {
        const channelId = raw.channel_id
        const existing = storedMap.get(channelId)
        if (!existing) continue

        existing.localBalance = (raw.local_balance?.toString?.() ?? String(raw.local_balance ?? 0))
        existing.remoteBalance = (raw.remote_balance?.toString?.() ?? String(raw.remote_balance ?? 0))
        existing.state = raw.state?.state_name ?? raw.state ?? existing.state
        existing.channelOutpoint = raw.channel_outpoint ?? existing.channelOutpoint ?? undefined
        await existing.save()
      }

      Logger.info('[Fiber] Synced %d channels for business %s', channels.length, businessId)
    } catch (error: any) {
      Logger.warn('[Fiber] Channel sync failed (non-fatal): %s', error.message)
    }
  }

  private getCurrencySymbol(): string {
    const network = this.fiberNetwork
    if (network === 'mainnet') return 'Fibb'
    if (network === 'devnet') return 'Fibd'
    return 'Fibt'
  }
}

export default new FiberServiceClass()

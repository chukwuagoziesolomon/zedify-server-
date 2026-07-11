import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import User from 'App/Models/User'
import BusinessFiberSetting from 'App/Models/BusinessFiberSetting'
import BusinessAcceptedSudt from 'App/Models/BusinessAcceptedSudt'
import FiberService from './FiberService'
import SudtService from './SudtService'
import { v4 as uuid } from 'uuid'

export interface BusinessFiberSetupInput {
  accept_ckb: boolean
  accept_sudt: boolean
  min_channel_balance?: number
  node_url?: string
}

export interface BusinessFiberSettingResponse {
  id: string
  business_id: string
  channel_id: string
  peer_id: string
  accept_ckb: boolean
  accept_sudt: boolean
  min_channel_balance: number
  created_at: string
  status: string
}

export interface FiberPaymentMethod {
  symbol: string
  type: 'native' | 'sudt'
  type_script?: string
  enabled: boolean
  balance?: number
}

class BusinessFiberSetupServiceClass {
  /**
   * Setup Fiber payments for a business
   * 1. Connect to Fiber node
   * 2. Create receiving channel
   * 3. Store configuration
   */
  async setupFiberForBusiness(
    businessId: string,
    input: BusinessFiberSetupInput
  ): Promise<BusinessFiberSettingResponse> {
    const trx = await Database.transaction()

    try {
      Logger.info(`[FiberSetup] Setting up Fiber for business: ${businessId}`)

      // Check if already setup
      const existing = await BusinessFiberSetting.query(trx)
        .where('businessId', businessId)
        .first()

      if (existing) {
        await trx.rollback()
        throw new Error('Fiber payments already enabled for this business')
      }

      // Verify business exists
      const business = await User.query(trx).where('uniqueId', businessId).first()
      if (!business) {
        await trx.rollback()
        throw new Error('Business not found')
      }

      // Initialize Fiber service
      await FiberService.initialize()

      // Get node info to verify connection
      const nodeInfo = await FiberService.getNodeInfo()
      Logger.info(`[FiberSetup] Connected to Fiber node: ${nodeInfo.peerId}`)

      // Create receiving channel (one-way channel for receiving payments)
      const channel = await FiberService.openChannel(
        businessId,
        nodeInfo.peerId,
        1.0, // Start with 1 CKB
        false, // Not public
        true // One-way (for receiving)
      )

      // Store settings
      const setting = await BusinessFiberSetting.create(
        {
          uniqueId: uuid(),
          businessId,
          fiberChannelId: channel.channelId,
          fiberPeerId: nodeInfo.peerId,
          acceptCkb: input.accept_ckb ?? true,
          acceptSudt: input.accept_sudt ?? true,
          minChannelBalance: input.min_channel_balance ?? 0.5,
          status: 'active',
        },
        { client: trx }
      )

      await trx.commit()

      Logger.info(
        `[FiberSetup] Fiber enabled for business ${businessId}, channel: ${channel.channelId}`
      )

      return {
        id: setting.uniqueId,
        business_id: businessId,
        channel_id: channel.channelId,
        peer_id: nodeInfo.peerId,
        accept_ckb: setting.acceptCkb,
        accept_sudt: setting.acceptSudt,
        min_channel_balance: setting.minChannelBalance,
        created_at: setting.createdAt.toISO(),
        status: setting.status,
      }
    } catch (error) {
      await trx.rollback()
      Logger.error(`[FiberSetup] Failed to setup Fiber: ${error.message}`)
      throw error
    }
  }

  /**
   * Get Fiber settings for a business
   */
  async getFiberSettings(businessId: string): Promise<BusinessFiberSetting | null> {
    return await BusinessFiberSetting.query()
      .where('businessId', businessId)
      .where('status', 'active')
      .first()
  }

  /**
   * Update settlement preferences
   */
  async updateSettlementPreferences(
    businessId: string,
    preferences: {
      auto_convert_daily?: boolean
      auto_convert_threshold?: number
      min_channel_balance?: number
      settlement_schedule?: string
    }
  ): Promise<BusinessFiberSetting> {
    const setting = await BusinessFiberSetting.query()
      .where('businessId', businessId)
      .firstOrFail()

    if (preferences.auto_convert_daily !== undefined) {
      setting.autoConvertDaily = preferences.auto_convert_daily
    }
    if (preferences.auto_convert_threshold !== undefined) {
      setting.autoConvertThreshold = preferences.auto_convert_threshold
    }
    if (preferences.min_channel_balance !== undefined) {
      setting.minChannelBalance = preferences.min_channel_balance
    }
    if (preferences.settlement_schedule !== undefined) {
      setting.settlementSchedule = preferences.settlement_schedule
    }

    await setting.save()

    Logger.info(`[FiberSetup] Settlement preferences updated for business: ${businessId}`)
    return setting
  }

  /**
   * Enable SUDT token acceptance for business
   */
  async enableSudtForBusiness(
    businessId: string,
    typeScript: string
  ): Promise<BusinessAcceptedSudt> {
    // Get token from registry
    const sudtToken = await SudtService.getSudtByTypeScript(typeScript)
    if (!sudtToken) {
      throw new Error(`SUDT token not found: ${typeScript}`)
    }

    // Check if already accepted
    const existing = await BusinessAcceptedSudt.query()
      .where('businessId', businessId)
      .where('sudtTypeScript', typeScript)
      .first()

    if (existing) {
      existing.enabled = true
      await existing.save()
      return existing
    }

    // Add to accepted tokens
    const accepted = await BusinessAcceptedSudt.create({
      uniqueId: uuid(),
      businessId,
      sudtTypeScript: sudtToken.typeScript,
      symbol: sudtToken.symbol,
      name: sudtToken.name,
      logo: sudtToken.logo,
      enabled: true,
      autoConvertEnabled: true,
      status: 'active',
    })

    Logger.info(
      `[FiberSetup] SUDT ${sudtToken.symbol} enabled for business: ${businessId}`
    )
    return accepted
  }

  /**
   * Disable SUDT token acceptance for business
   */
  async disableSudtForBusiness(businessId: string, typeScript: string): Promise<void> {
    await BusinessAcceptedSudt.query()
      .where('businessId', businessId)
      .where('sudtTypeScript', typeScript)
      .update({ enabled: false })

    Logger.info(
      `[FiberSetup] SUDT ${typeScript} disabled for business: ${businessId}`
    )
  }

  /**
   * Get accepted SUDT tokens for business
   */
  async getAcceptedSudtTokens(businessId: string): Promise<BusinessAcceptedSudt[]> {
    return await BusinessAcceptedSudt.query()
      .where('businessId', businessId)
      .where('enabled', true)
      .where('status', 'active')
  }

  /**
   * Get payment methods available for business
   */
  async getAvailablePaymentMethods(businessId: string): Promise<FiberPaymentMethod[]> {
    const setting = await this.getFiberSettings(businessId)
    if (!setting) {
      return []
    }

    const methods: FiberPaymentMethod[] = []

    // Add native CKB if enabled
    if (setting.acceptCkb) {
      methods.push({
        symbol: 'CKB',
        type: 'native',
        enabled: true,
      })
    }

    // Add SUDT tokens if enabled
    if (setting.acceptSudt) {
      const sudtTokens = await this.getAcceptedSudtTokens(businessId)
      for (const token of sudtTokens) {
        methods.push({
          symbol: token.symbol,
          type: 'sudt',
          type_script: token.sudtTypeScript,
          enabled: token.enabled,
        })
      }
    }

    return methods
  }

  /**
   * Get business Fiber channel info
   */
  async getChannelInfo(businessId: string) {
    const setting = await this.getFiberSettings(businessId)
    if (!setting) {
      throw new Error('Fiber not enabled for this business')
    }

    try {
      const channels = await FiberService.listChannels(businessId, false)
      const channel = channels.find((ch) => ch.channelId === setting.fiberChannelId)

      return {
        channel_id: setting.fiberChannelId,
        peer_id: setting.fiberPeerId,
        local_balance_ckb: channel?.localBalanceCKB ?? 0,
        remote_balance_ckb: channel?.remoteBalanceCKB ?? 0,
        state: channel?.state ?? 'unknown',
        is_public: channel?.isPublic ?? false,
        is_one_way: channel?.isOneWay ?? true,
      }
    } catch (error) {
      Logger.warn(`[FiberSetup] Could not fetch channel info: ${error.message}`)
      return {
        channel_id: setting.fiberChannelId,
        peer_id: setting.fiberPeerId,
        error: 'Could not fetch channel info from Fiber node',
      }
    }
  }

  /**
   * Disable Fiber for business (soft delete)
   */
  async disableFiberForBusiness(businessId: string): Promise<void> {
    await BusinessFiberSetting.query()
      .where('businessId', businessId)
      .update({ status: 'inactive' })

    Logger.info(`[FiberSetup] Fiber disabled for business: ${businessId}`)
  }
}

export default new BusinessFiberSetupServiceClass()

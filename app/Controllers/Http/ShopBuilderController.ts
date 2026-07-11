import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import Shop from 'App/Models/Shop'
import User from 'App/Models/User'
import AiShopBuilderService from 'App/Services/AiShopBuilderService'
import { FileUploadService } from 'App/Services/FileUploadService'
import { genRandomUuid } from 'App/helpers/utils'
import Env from '@ioc:Adonis/Core/Env'

export default class ShopBuilderController extends RolesController {
  private get baseDomain(): string {
    return Env.get('SHOP_BASE_DOMAIN', 'yourdomain.com')
  }

  /**
   * GET /user/shop
   * Get the authenticated user's shop (or null if none exists yet).
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).first()
      if (!shop) {
        return response.ok(formatSuccessMessage('No shop found', null))
      }
      return response.ok(formatSuccessMessage('Shop retrieved', this.formatShop(shop)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop
   * Create a new shop for the authenticated user.
   * Body: { business_name, subdomain, description?, currency? }
   */
  public async create({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)

      const existing = await Shop.query().where('userId', uniqueId).first()
      if (existing) throw new Error('You already have a shop. Use PUT /user/shop to update it.')

      const { business_name, subdomain, description, currency } = request.only([
        'business_name', 'subdomain', 'description', 'currency',
      ])

      if (!business_name) throw new Error('business_name is required.')
      if (!subdomain) throw new Error('subdomain is required.')

      const cleanSubdomain = String(subdomain).toLowerCase().replace(/[^a-z0-9-]/g, '-')

      const taken = await Shop.query().where('subdomain', cleanSubdomain).first()
      if (taken) throw new Error(`Subdomain "${cleanSubdomain}" is already taken.`)

      const shop = await Shop.create({
        uniqueId: genRandomUuid(),
        userId: uniqueId,
        businessName: String(business_name).trim(),
        subdomain: cleanSubdomain,
        description: description ? String(description).trim() : null,
        currency: currency || 'NGN',
        status: 'draft',
      })

      return response.ok(formatSuccessMessage('Shop created successfully', this.formatShop(shop)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /user/shop
   * Update shop details.
   * Body: { business_name?, description?, currency?, status? }
   */
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const { business_name, description, currency, status } = request.only([
        'business_name', 'description', 'currency', 'status',
      ])

      if (business_name) shop.businessName = String(business_name).trim()
      if (description !== undefined) shop.description = description ? String(description).trim() : null
      if (currency) shop.currency = String(currency).toUpperCase()
      if (status && ['draft', 'published'].includes(status)) shop.status = status

      await shop.save()

      return response.ok(formatSuccessMessage('Shop updated', this.formatShop(shop)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop/logo
   * Upload shop logo (Cloudinary).
   * Body (multipart): { logo: File }
   */
  public async uploadLogo({ auth, request, response }: HttpContextContract) {
    const fileService = new FileUploadService()
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const file = request.file('logo', { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
      if (!file) throw new Error('logo file is required.')
      if (!file.isValid) throw new Error(file.errors?.[0]?.message ?? 'Invalid file.')

      if (shop.logoPublicId) await fileService.deleteFile(shop.logoPublicId)

      const uploaded = await fileService.uploadProfileImage(file, `shop-logo-${shop.uniqueId}`)
      shop.logoUrl = uploaded.url
      shop.logoPublicId = uploaded.path
      await shop.save()

      return response.ok(formatSuccessMessage('Logo uploaded', { logo_url: shop.logoUrl }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop/banner
   * Upload shop banner (Cloudinary).
   * Body (multipart): { banner: File }
   */
  public async uploadBanner({ auth, request, response }: HttpContextContract) {
    const fileService = new FileUploadService()
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const file = request.file('banner', { size: '10mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
      if (!file) throw new Error('banner file is required.')
      if (!file.isValid) throw new Error(file.errors?.[0]?.message ?? 'Invalid file.')

      if (shop.bannerPublicId) await fileService.deleteFile(shop.bannerPublicId)

      const uploaded = await fileService.uploadProfileImage(file, `shop-banner-${shop.uniqueId}`)
      shop.bannerUrl = uploaded.url
      shop.bannerPublicId = uploaded.path
      await shop.save()

      return response.ok(formatSuccessMessage('Banner uploaded', { banner_url: shop.bannerUrl }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // ─── AI Agent ────────────────────────────────────────────────────────────────

  /**
   * POST /user/shop/ai/chat
   * Send a message to the AI shop builder agent.
   * The agent has full memory of the conversation and current shop/product state.
   * Body: { message: string }
   */
  public async aiChat({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const message = request.input('message')
      if (!message || !String(message).trim()) throw new Error('message is required.')

      const result = await AiShopBuilderService.chat(shop.uniqueId, String(message).trim())

      return response.ok(formatSuccessMessage('AI response', {
        reply: result.reply,
        action: result.action,
        conversation_id: result.conversationId,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /user/shop/ai/history
   * Get the full AI conversation history for the shop.
   */
  public async aiHistory({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const history = await AiShopBuilderService.getHistory(shop.uniqueId)
      // Strip reasoning_details from history response (internal use only)
      const clean = history.map(({ role, content }) => ({ role, content }))

      return response.ok(formatSuccessMessage('Conversation history', clean))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /user/shop/ai/memory
   * Reset the AI conversation memory (start fresh).
   */
  public async aiResetMemory({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      await AiShopBuilderService.resetMemory(shop.uniqueId)

      return response.ok(formatSuccessMessage('AI memory cleared', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private formatShop(shop: Shop) {
    return {
      id: shop.uniqueId,
      business_name: shop.businessName,
      subdomain: shop.subdomain,
      shop_url: `https://${shop.subdomain}.${this.baseDomain}`,
      description: shop.description,
      logo_url: shop.logoUrl,
      banner_url: shop.bannerUrl,
      theme_config: shop.themeConfig,
      pages_config: shop.pagesConfig,
      status: shop.status,
      currency: shop.currency,
      created_at: shop.createdAt,
    }
  }
}

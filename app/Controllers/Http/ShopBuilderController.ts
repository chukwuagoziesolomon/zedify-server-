import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage, genRandomUuid, genPaymentLinkSlug } from 'App/helpers/utils'
import RolesController from './RolesController'
import Shop from 'App/Models/Shop'
import ShopProduct from 'App/Models/ShopProduct'
import AiShopBuilderService from 'App/Services/AiShopBuilderService'
import { FileUploadService } from 'App/Services/FileUploadService'
import Env from '@ioc:Adonis/Core/Env'
import PaymentLink from 'App/Models/PaymentLink'
import { PaymentLinkStatus } from 'App/Lib/types'
import { getDefaultFeatures, getTemplatePreset, ShopFeatures } from 'App/Lib/shopFeatures'
import Logger from '@ioc:Adonis/Core/Logger'

export default class ShopBuilderController extends RolesController {
  private get baseDomain(): string {
    const configured = Env.get('SHOP_BASE_DOMAIN', '')
    if (configured) return configured
    const host = Env.get('HOST', 'localhost')
    const port = Env.get('PORT', '3333')
    return `${host}:${port}`
  }

  /**
   * Build the shop URL. In production this is a subdomain:
   *   https://mystore.yourdomain.com
   * In development (when baseDomain contains localhost or a port), it falls
   * back to a path-based URL the frontend can navigate to:
   *   http://localhost:3000/shop/mystore
   */
  private buildShopUrl(subdomain: string): string {
    const base = this.baseDomain.replace(/\/+$/, '') // strip trailing slash
    const isLocal =
      base.includes('localhost') ||
      base.includes('127.0.0.1') ||
      /:\d+/.test(base)

    if (isLocal) {
      // Path-based: frontend handles /shop/:subdomain routing
      return `${base}/shop/${subdomain}`
    }
    // Subdomain-based for staging/production
    const cleanBase = base.replace(/^https?:\/\//, '')
    return `https://${subdomain}.${cleanBase}`
  }

  /**
   * GET /user/shop
   * Get the authenticated user's shop (or null if none exists yet).
   * Query: shop_id? — if provided, returns that specific shop; otherwise returns the first/active shop.
   */
  public async show({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shopId = request.input('shop_id')

      let shop: Shop | null = null
      if (shopId) {
        shop = await Shop.query().where('uniqueId', shopId).where('userId', uniqueId).first()
      } else {
        shop = await Shop.query().where('userId', uniqueId).orderBy('createdAt', 'asc').first()
      }

      if (!shop) {
        return response.ok(formatSuccessMessage('No shop found', null))
      }
      const paymentGateway = await this.ensureShopPaymentGateway(shop)
      return response.ok(formatSuccessMessage('Shop retrieved', this.formatShop(shop, paymentGateway)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /user/shops
   * List all shops for the authenticated user.
   */
  public async index({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shops = await Shop.query().where('userId', uniqueId).orderBy('createdAt', 'desc')

      const formatted = await Promise.all(
        shops.map(async (shop) => {
          const paymentGateway = await this.ensureShopPaymentGateway(shop)
          return this.formatShop(shop, paymentGateway)
        })
      )

      return response.ok(formatSuccessMessage('Shops retrieved', formatted))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop
   * Create a new shop for the authenticated user.
   * Users can have multiple shops as long as their product categories don't overlap.
   */
  public async create({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)

      const payload = this.resolveShopCreationPayload(request.all())

      if (!payload.businessName) throw new Error('business_name is required.')
      if (!payload.subdomain) throw new Error('subdomain is required.')

      const cleanSubdomain = String(payload.subdomain).toLowerCase().replace(/[^a-z0-9-]/g, '-')

      const taken = await Shop.query().where('subdomain', cleanSubdomain).first()
      if (taken) throw new Error(`Subdomain "${cleanSubdomain}" is already taken.`)

      const templateKey = payload.template || 'yanga-default'
      const preset = getTemplatePreset(templateKey)
      const defaultFeatures = getDefaultFeatures(templateKey)

      const shopData: any = {
        uniqueId: genRandomUuid(),
        userId: uniqueId,
        businessName: String(payload.businessName).trim(),
        subdomain: cleanSubdomain,
        description: payload.description ? String(payload.description).trim() : null,
        currency: payload.currency || 'NGN',
        status: payload.shopType === 'ai_custom' ? 'draft' : 'published',
        shopType: payload.shopType,
        template: templateKey,
        customizationAccessPaid: false,
        customizationPaymentReferenceId: payload.customizationPaymentReferenceId,
      }

      let shop: Shop
      try {
        shopData.features = payload.features || defaultFeatures
        shop = await Shop.create(shopData)
      } catch (error: any) {
        if (error.message?.includes('column "features" of relation "shops" does not exist')) {
          delete shopData.features
          shop = await Shop.create(shopData)
          Logger.warn('[ShopBuilder] Created shop without features column. Run migration 1790000000007 to enable features.')
        } else {
          throw error
        }
      }

      if (payload.themeConfig) {
        shop.themeConfig = payload.themeConfig
      } else {
        shop.themeConfig = { ...preset.defaultTheme, template: templateKey }
      }
      if (payload.pagesConfig) {
        shop.pagesConfig = payload.pagesConfig
      }
      await shop.save()

      const paymentGateway = await this.ensureShopPaymentGateway(shop)

      return response.ok(formatSuccessMessage('Shop created successfully', this.formatShop(shop, paymentGateway)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /user/shop
   * Update shop details.
   * Body: { business_name?, description?, currency?, status?, features?, theme_config?, pages_config? }
   */
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const { business_name, description, currency, status, features, theme_config, pages_config } = request.only([
        'business_name', 'description', 'currency', 'status', 'features', 'theme_config', 'pages_config',
      ])

      if (business_name) shop.businessName = String(business_name).trim()
      if (description !== undefined) shop.description = description ? String(description).trim() : null
      if (currency) shop.currency = String(currency).toUpperCase()
      if (status && ['draft', 'published'].includes(status)) shop.status = status
      if (features) shop.features = features as ShopFeatures
      if (theme_config !== undefined) shop.themeConfig = theme_config
      if (pages_config !== undefined) shop.pagesConfig = pages_config

      await shop.save()

      const paymentGateway = await this.ensureShopPaymentGateway(shop)

      return response.ok(formatSuccessMessage('Shop updated', this.formatShop(shop, paymentGateway)))
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

      this.ensureAiCustomizationAccess(shop)

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

      this.ensureAiCustomizationAccess(shop)

      const { messages, summaryMemory, entityMemory } = await AiShopBuilderService.getHistory(shop.uniqueId)
      const clean = messages.map(({ role, content }) => ({ role, content }))

      return response.ok(formatSuccessMessage('Conversation history', {
        messages: clean,
        summary_memory: summaryMemory,
        entity_memory: entityMemory,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop/ai/chat/stream
   *
   * SSE streaming chat endpoint. Opens a persistent text/event-stream response
   * and pushes AI tokens one by one as they are generated.
   *
   * Body: { message: string }
   *
   * SSE Event types:
   *   data: {"type":"token","content":"..."}
   *   data: {"type":"action","action":{...}}
   *   data: {"type":"done","conversation_id":"..."}
   *   data: {"type":"error","message":"..."}
   *
   * Frontend example:
   *   const res = await fetch('/api/user/shop/ai/chat/stream', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
   *     body: JSON.stringify({ message: 'Make my shop look modern and bold' }),
   *   })
   *   const reader = res.body.getReader()
   *   // read chunks and split on '\n\n' to parse individual SSE events
   */
  public async aiChatStream({ auth, request, response }: HttpContextContract) {
    let uniqueId: string
    try {
      uniqueId = this.allowOnlyLoggedInUsers(auth)
    } catch {
      return response.unauthorized({ error: 'Unauthorized' })
    }

    const message = request.input('message')
    if (!message || !String(message).trim()) {
      return response.badRequest({ error: 'message is required.' })
    }

    let shop: Shop
    try {
      shop = await Shop.query().where('userId', uniqueId).firstOrFail()
    } catch {
      return response.notFound({ error: 'Shop not found.' })
    }

    this.ensureAiCustomizationAccess(shop)

    // Set SSE headers before writing any body
    const res = response.response
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
    res.flushHeaders()

    const write = (event: object) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        // Client disconnected — ignore write errors
      }
    }

    // Heartbeat to prevent proxy / browser 30s timeout
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n') } catch { clearInterval(heartbeat) }
    }, 20000)

    try {
      for await (const event of AiShopBuilderService.chatStream(
        shop.uniqueId,
        String(message).trim()
      )) {
        write(event)
        if (event.type === 'done' || event.type === 'error') break
      }
    } catch (err: any) {
      write({ type: 'error', message: err.message ?? 'Unexpected error' })
    } finally {
      clearInterval(heartbeat)
      res.end()
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

      this.ensureAiCustomizationAccess(shop)

      await AiShopBuilderService.resetMemory(shop.uniqueId)

      return response.ok(formatSuccessMessage('AI memory cleared', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // ─── Public storefront endpoint (no auth) ──────────────────────────────────

  /**
   * GET /api/storefront/:subdomain
   * Public endpoint — returns shop data, products, and checkout URL
   * for the storefront frontend to render at /shop/:subdomain.
   */
  public async storefront({ params, response }: HttpContextContract) {
    try {
      const shop = await Shop.query()
        .where('subdomain', params.subdomain)
        .first()

      if (!shop) {
        return response.notFound({ error: true, message: 'Shop not found' })
      }

      const products = await ShopProduct.query()
        .where('shopId', shop.uniqueId)
        .where('isActive', true)
        .orderBy('createdAt', 'desc')

      const gateway = await this.ensureShopPaymentGateway(shop)

      return response.ok({
        error: false,
        data: {
          id: shop.uniqueId,
          business_name: shop.businessName,
          subdomain: shop.subdomain,
          description: shop.description,
          logo_url: shop.logoUrl,
          banner_url: shop.bannerUrl,
          theme_config: shop.themeConfig,
          currency: shop.currency,
          status: shop.status,
          checkout_url: gateway.checkout_url,
          payment_link_id: gateway.payment_link_id,
          products: products.map((p) => ({
            id: p.uniqueId,
            name: p.name,
            price: p.price,
            currency: p.currency,
            description: p.description,
            category: p.category,
            images: p.images ?? [],
            stock: p.stock,
            track_stock: p.trackStock,
            variants: p.variants,
          })),
        },
      })
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  public resolveShopCreationPayload(input: Record<string, any>) {
    const businessName = input.business_name ?? input.name ?? input.businessName ?? null
    const subdomain = input.subdomain ?? input.slug ?? input.domain ?? null
    const description = input.description ?? input.descriptionText ?? null
    const currency = input.currency ?? input.default_currency ?? null
    const shopType = input.shop_type ?? input.shopType ?? (input.template && input.template !== 'yanga-default' ? 'ai_custom' : 'default')
    const template = input.template ?? (shopType === 'ai_custom' ? 'ai-custom' : 'yanga-default')

    return {
      businessName,
      subdomain,
      description,
      currency,
      shopType,
      template,
      requiresPayment: shopType === 'ai_custom',
      customizationPaymentReferenceId: input.customization_payment_reference_id ?? input.customizationPaymentReferenceId ?? (shopType === 'ai_custom' ? `shop-custom-${genRandomUuid()}` : null),
      themeConfig: input.theme_config ?? input.themeConfig ?? null,
      pagesConfig: input.pages_config ?? input.pagesConfig ?? null,
      primaryCategory: input.primaryCategory ?? input.primary_category ?? null,
      allowPayOnDelivery: input.allowPayOnDelivery ?? input.allow_pay_on_delivery ?? false,
      acceptedCurrencyIds: input.acceptedCurrencyIds ?? input.accepted_currency_ids ?? null,
      features: input.features ?? null,
    }
  }

  public async ensureShopPaymentGateway(shop: Shop) {
    const existingLink = await PaymentLink.query().where('businessId', shop.userId).first()
    if (existingLink) {
      return {
        enabled: true,
        payment_link_id: existingLink.uniqueId,
        checkout_url: `/api/pay/${existingLink.slug}`,
      }
    }

    let slug = genPaymentLinkSlug()
    while (await PaymentLink.query().where('slug', slug).first()) {
      slug = genPaymentLinkSlug()
    }

    const paymentLink = await PaymentLink.create({
      uniqueId: genRandomUuid(),
      businessId: shop.userId,
      slug,
      title: shop.businessName || 'Shop Payments',
      description: shop.description || 'Crypto payments for this shop',
      fiatCurrencyId: null,
      fiatAmount: null,
      status: PaymentLinkStatus.ACTIVE,
      isSingleUse: false,
      usageCount: 0,
      usageLimit: null,
      expiresAt: null,
    })

    return {
      enabled: true,
      payment_link_id: paymentLink.uniqueId,
      checkout_url: `/api/pay/${paymentLink.slug}`,
    }
  }

  private ensureAiCustomizationAccess(shop: Shop) {
    if (shop.shopType === 'ai_custom' && !shop.customizationAccessPaid) {
      throw new Error('AI customization access requires a completed payment first.')
    }
  }

  private formatShop(shop: Shop, paymentGateway?: { enabled: boolean; payment_link_id: string | null; checkout_url: string | null }) {
    const shopUrl = this.buildShopUrl(shop.subdomain)
    const checkoutUrl = paymentGateway?.checkout_url ?? null
    return {
      id: shop.uniqueId,
      business_name: shop.businessName,
      subdomain: shop.subdomain,
      shop_url: shopUrl,
      storefront_url: shopUrl,
      checkout_url: checkoutUrl,
      description: shop.description,
      logo_url: shop.logoUrl,
      banner_url: shop.bannerUrl,
      theme_config: shop.themeConfig,
      pages_config: shop.pagesConfig,
      status: shop.status,
      currency: shop.currency,
      shop_type: shop.shopType,
      template: shop.template,
      features: shop.features,
      customization_access: {
        required: shop.shopType === 'ai_custom',
        paid: shop.customizationAccessPaid,
        paid_at: shop.customizationAccessPaidAt?.toISO() ?? null,
        payment_reference_id: shop.customizationPaymentReferenceId,
      },
      created_at: shop.createdAt,
      payment_gateway: paymentGateway || {
        enabled: false,
        payment_link_id: null,
        checkout_url: null,
      },
      preview: {
        url: shopUrl,
        iframe_src: shopUrl,
        is_live: shop.status === 'published',
      },
    }
  }
}

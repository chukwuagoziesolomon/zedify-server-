import Logger from '@ioc:Adonis/Core/Logger'
import Shop from 'App/Models/Shop'

const VALID_CATEGORIES = ['food', 'fashion', 'gadgets', 'vehicles'] as const
type ShopCategory = (typeof VALID_CATEGORIES)[number]

// keep in sync with the CATS colour map in the Yanga storefront template
const CATEGORY_DEFAULT_COLORS: Record<ShopCategory, string> = {
  food: '#2F6B4F',
  fashion: '#F2A93B',
  gadgets: '#1C2B4A',
  vehicles: '#E14B3D',
}

interface CreateShopParams {
  ownerId: number
  name: string
  primaryCategory: string
  logoUrl?: string
  colorPrimary?: string
  colorAccent?: string
  colorHighlight?: string
  allowPayOnDelivery?: boolean
  acceptedCurrencyIds: number[]
}

class ShopBuilderService {
  /**
   * Creates a shop on the free default template (theming only — colors/logo,
   * zero AI token cost). Upgrading to a custom AI-generated theme is a
   * separate, explicit action (see requestCustomTheme below), not something
   * that happens implicitly here.
   */
  async createFromDefaultTemplate(params: CreateShopParams): Promise<Shop> {
    if (!VALID_CATEGORIES.includes(params.primaryCategory as ShopCategory)) {
      throw new Error(
        `Unsupported category "${params.primaryCategory}". Supported: ${VALID_CATEGORIES.join(', ')}`
      )
    }

    const slug = await this.generateUniqueSlug(params.name)
    const fallbackColor = CATEGORY_DEFAULT_COLORS[params.primaryCategory as ShopCategory]

    const shop = new Shop()
    shop.ownerId = params.ownerId
    shop.name = params.name
    shop.slug = slug
    shop.primaryCategory = params.primaryCategory
    shop.template = 'yanga-default'
    shop.logoUrl = params.logoUrl ?? null
    shop.colorPrimary = params.colorPrimary ?? '#1C2B4A'
    shop.colorAccent = params.colorAccent ?? fallbackColor
    shop.colorHighlight = params.colorHighlight ?? '#F2A93B'
    shop.allowPayOnDelivery = params.allowPayOnDelivery ?? false // owner's explicit choice, not forced
    shop.acceptedCurrencyIds = params.acceptedCurrencyIds
    shop.isCustomAiTheme = false
    shop.status = 'active'
    await shop.save()

    Logger.info(`[ShopBuilder] Created shop "${shop.name}" (${shop.slug}) on default template`)
    return shop
  }

  /** Pure theming update — colors/logo only, still zero AI cost. */
  async updateTheme(
    shopUniqueId: string,
    theme: { logoUrl?: string; colorPrimary?: string; colorAccent?: string; colorHighlight?: string }
  ): Promise<Shop> {
    const shop = await Shop.query().where('uniqueId', shopUniqueId).firstOrFail()
    if (theme.logoUrl !== undefined) shop.logoUrl = theme.logoUrl
    if (theme.colorPrimary) shop.colorPrimary = theme.colorPrimary
    if (theme.colorAccent) shop.colorAccent = theme.colorAccent
    if (theme.colorHighlight) shop.colorHighlight = theme.colorHighlight
    await shop.save()
    return shop
  }

  /**
   * Marks a shop as upgraded to a custom AI-generated theme. The actual
   * AI generation call is a separate, explicitly-billed flow — this method
   * just flips the flag once that flow completes successfully, so it's
   * intentionally not implemented here (belongs in a dedicated
   * AiThemeGenerationService with its own credit/billing checks).
   */
  async markCustomThemeApplied(shopUniqueId: string): Promise<Shop> {
    const shop = await Shop.query().where('uniqueId', shopUniqueId).firstOrFail()
    shop.isCustomAiTheme = true
    await shop.save()
    return shop
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    let slug = base
    let suffix = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await Shop.query().where('slug', slug).first()
      if (!existing) return slug
      suffix += 1
      slug = `${base}-${suffix}`
    }
  }
}

export default new ShopBuilderService()

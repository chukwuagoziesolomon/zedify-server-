import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Shop from 'App/Models/Shop'
import ShopBuilderService from 'App/Services/ShopBuilderService'

export default class ShopController {
  /**
   * POST /api/shops
   * body: { name, primaryCategory, logoUrl?, colorPrimary?, colorAccent?,
   *         colorHighlight?, allowPayOnDelivery?, acceptedCurrencyIds }
   * Creates a shop on the free Yanga default template — zero AI cost.
   */
  public async store({ auth, request, response }: HttpContextContract) {
    const payload = request.only([
      'name',
      'primaryCategory',
      'logoUrl',
      'colorPrimary',
      'colorAccent',
      'colorHighlight',
      'allowPayOnDelivery',
      'acceptedCurrencyIds',
    ])

    if (!payload.name || !payload.primaryCategory) {
      return response.badRequest({ error: 'name and primaryCategory are required' })
    }
    if (!payload.acceptedCurrencyIds || payload.acceptedCurrencyIds.length === 0) {
      return response.badRequest({ error: 'At least one accepted currency is required' })
    }

    try {
      const shop = await ShopBuilderService.createFromDefaultTemplate({
        ownerId: auth.user!.id,
        ...payload,
      })
      return response.created({ shop: this.serialize(shop) })
    } catch (error) {
      return response.badRequest({ error: error.message })
    }
  }

  /**
   * PATCH /api/shops/:id/theme
   * Free-tier theming update — colors and logo only.
   */
  public async updateTheme({ params, request, response }: HttpContextContract) {
    const theme = request.only(['logoUrl', 'colorPrimary', 'colorAccent', 'colorHighlight'])
    const shop = await ShopBuilderService.updateTheme(params.id, theme)
    return response.ok({ shop: this.serialize(shop) })
  }

  /**
   * PATCH /api/shops/:id/checkout-settings
   * Owner-controlled: pay-on-delivery toggle and accepted currencies.
   * Deliberately separate from theming — this affects money flow, not looks.
   */
  public async updateCheckoutSettings({ params, request, response }: HttpContextContract) {
    const { allowPayOnDelivery, acceptedCurrencyIds } = request.only(['allowPayOnDelivery', 'acceptedCurrencyIds'])
    const shop = await Shop.query().where('uniqueId', params.id).firstOrFail()

    if (allowPayOnDelivery !== undefined) shop.allowPayOnDelivery = allowPayOnDelivery
    if (acceptedCurrencyIds) shop.acceptedCurrencyIds = acceptedCurrencyIds
    await shop.save()

    return response.ok({ shop: this.serialize(shop) })
  }

  /**
   * GET /api/shops/:slug
   * Public storefront lookup — this is what the Yanga template's frontend
   * fetches to know which colors/logo/category/checkout options to render.
   */
  public async showBySlug({ params, response }: HttpContextContract) {
    const shop = await Shop.query().where('slug', params.slug).where('status', 'active').firstOrFail()
    return response.ok({ shop: this.serialize(shop) })
  }

  private serialize(shop: Shop) {
    return {
      id: shop.uniqueId,
      name: shop.name,
      slug: shop.slug,
      primaryCategory: shop.primaryCategory,
      template: shop.template,
      logoUrl: shop.logoUrl,
      theme: {
        primary: shop.colorPrimary,
        accent: shop.colorAccent,
        highlight: shop.colorHighlight,
      },
      allowPayOnDelivery: shop.allowPayOnDelivery,
      acceptedCurrencyIds: shop.acceptedCurrencyIds,
      isCustomAiTheme: shop.isCustomAiTheme,
    }
  }
}

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import ShopDeliverySetting from 'App/Models/ShopDeliverySetting'
import Shop from 'App/Models/Shop'
import { genRandomUuid } from 'App/helpers/utils'

export default class ShopDeliverySettingController extends RolesController {
  /**
   * GET /api/user/shop/delivery-settings
   * Get delivery settings for the authenticated user's shop.
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', userId).first()
      if (!shop) throw new Error('No shop found. Please create a shop first.')

      const settings = await ShopDeliverySetting.query().where('shopId', shop.uniqueId).first()
      if (!settings) {
        const created = await ShopDeliverySetting.create({
          uniqueId: genRandomUuid(),
          shopId: shop.uniqueId,
          hasFreeDelivery: false,
          deliveryFee: 0,
          discountPercentage: 0,
          discountAmount: 0,
        })
        return response.ok(formatSuccessMessage('Delivery settings retrieved', this.formatSettings(created)))
      }

      return response.ok(formatSuccessMessage('Delivery settings retrieved', this.formatSettings(settings)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /api/user/shop/delivery-settings
   * Update delivery settings for the shop.
   * Body: {
   *   has_free_delivery?: boolean,
   *   delivery_fee?: number,
   *   delivery_zones?: { [state: string]: number },
   *   discount_percentage?: number,
   *   discount_amount?: number,
   *   promo_code?: string,
   *   free_delivery_threshold?: number | null
   * }
   */
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', userId).first()
      if (!shop) throw new Error('No shop found. Please create a shop first.')

      const settings = await ShopDeliverySetting.query().where('shopId', shop.uniqueId).first()
      const payload = request.all()

      if (!settings) {
        const newSettings = await ShopDeliverySetting.create({
          uniqueId: genRandomUuid(),
          shopId: shop.uniqueId,
          hasFreeDelivery: payload.has_free_delivery ?? false,
          deliveryFee: payload.delivery_fee ?? 0,
          deliveryZones: payload.delivery_zones ?? null,
          discountPercentage: payload.discount_percentage ?? 0,
          discountAmount: payload.discount_amount ?? 0,
          promoCode: payload.promo_code ?? null,
          freeDeliveryThreshold: payload.free_delivery_threshold ?? null,
        })
        return response.ok(formatSuccessMessage('Delivery settings created', this.formatSettings(newSettings)))
      }

      if (payload.has_free_delivery !== undefined) settings.hasFreeDelivery = Boolean(payload.has_free_delivery)
      if (payload.delivery_fee !== undefined) settings.deliveryFee = Number(payload.delivery_fee)
      if (payload.delivery_zones !== undefined) settings.deliveryZones = payload.delivery_zones
      if (payload.discount_percentage !== undefined) settings.discountPercentage = Number(payload.discount_percentage)
      if (payload.discount_amount !== undefined) settings.discountAmount = Number(payload.discount_amount)
      if (payload.promo_code !== undefined) settings.promoCode = payload.promo_code || null
      if (payload.free_delivery_threshold !== undefined) settings.freeDeliveryThreshold = payload.free_delivery_threshold || null

      await settings.save()

      return response.ok(formatSuccessMessage('Delivery settings updated', this.formatSettings(settings)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * GET /api/shop/:subdomain/delivery-settings
   * Public endpoint for customers to view delivery settings for a shop.
   */
  public async publicShow({ params, response }: HttpContextContract) {
    try {
      const shop = await Shop.query().where('subdomain', params.subdomain).firstOrFail()
      const settings = await ShopDeliverySetting.query().where('shopId', shop.uniqueId).first()

      const result = settings
        ? this.formatSettings(settings)
        : {
            has_free_delivery: false,
            delivery_fee: 0,
            delivery_zones: null,
            discount_percentage: 0,
            discount_amount: 0,
            promo_code: null,
            free_delivery_threshold: null,
          }

      return response.ok(formatSuccessMessage('Delivery settings retrieved', result))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  private formatSettings(settings: ShopDeliverySetting) {
    return {
      id: settings.uniqueId,
      shop_id: settings.shopId,
      has_free_delivery: settings.hasFreeDelivery,
      delivery_fee: settings.deliveryFee,
      delivery_zones: settings.deliveryZones,
      discount_percentage: settings.discountPercentage,
      discount_amount: settings.discountAmount,
      promo_code: settings.promoCode,
      free_delivery_threshold: settings.freeDeliveryThreshold,
    }
  }
}

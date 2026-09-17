import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { DateTime } from 'luxon'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import OrderMessage from 'App/Models/OrderMessage'
import PaymentIntent from 'App/Models/PaymentIntent'
import Shop from 'App/Models/Shop'
import { genRandomUuid } from 'App/helpers/utils'

export default class OrderMessageController extends RolesController {
  private async getShop(userId: string, shopId?: string) {
    const query = Shop.query().where('userId', userId)
    if (shopId) query.where('uniqueId', shopId)
    return query.orderBy('createdAt', 'asc').firstOrFail()
  }

  public async index({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const orderId = request.input('order_id')

      if (!orderId) {
        return response.badRequest(await formatErrorMessage(new Error('order_id is required')))
      }

      const order = await PaymentIntent.query()
        .where('uniqueId', orderId)
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .firstOrFail()

      const messages = await OrderMessage.query()
        .where('paymentIntentId', order.uniqueId)
        .orderBy('createdAt', 'asc')

      return response.ok(formatSuccessMessage('Order messages retrieved', {
        data: messages.map((msg) => ({
          id: msg.uniqueId,
          sender_id: msg.senderId,
          sender_type: msg.senderType,
          message: msg.message,
          is_read: msg.isRead,
          created_at: msg.createdAt,
          updated_at: msg.updatedAt,
        })),
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  public async store({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const orderId = request.input('order_id')
      const { message, sender_type = 'merchant' } = request.only(['message', 'sender_type'])

      if (!orderId) {
        return response.badRequest(await formatErrorMessage(new Error('order_id is required')))
      }
      if (!message || !String(message).trim()) {
        return response.badRequest(await formatErrorMessage(new Error('message is required')))
      }

      const order = await PaymentIntent.query()
        .where('uniqueId', orderId)
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .firstOrFail()

      const orderMessage = await OrderMessage.create({
        uniqueId: genRandomUuid(),
        paymentIntentId: order.uniqueId,
        senderId: userId,
        senderType: sender_type as 'customer' | 'merchant' | 'system',
        message: String(message).trim(),
        isRead: false,
        readAt: null,
      })

      return response.ok(formatSuccessMessage('Order message sent', {
        id: orderMessage.uniqueId,
        sender_id: orderMessage.senderId,
        sender_type: orderMessage.senderType,
        message: orderMessage.message,
        is_read: orderMessage.isRead,
        created_at: orderMessage.createdAt,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  public async markAsRead({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const orderId = request.input('order_id')

      if (!orderId) {
        return response.badRequest(await formatErrorMessage(new Error('order_id is required')))
      }

      const order = await PaymentIntent.query()
        .where('uniqueId', orderId)
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .firstOrFail()

      await OrderMessage.query()
        .where('paymentIntentId', order.uniqueId)
        .where('isRead', false)
        .update({ isRead: true, readAt: DateTime.now() })

      return response.ok(formatSuccessMessage('Messages marked as read', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

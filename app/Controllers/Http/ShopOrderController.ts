import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import PaymentIntent from 'App/Models/PaymentIntent'
import Shop from 'App/Models/Shop'
import RolesController from './RolesController'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const
type OrderStatus = typeof ORDER_STATUSES[number]

export default class ShopOrderController extends RolesController {
  private async getShop(userId: string, shopId?: string) {
    const query = Shop.query().where('userId', userId)
    if (shopId) query.where('uniqueId', shopId)
    return query.orderBy('createdAt', 'asc').firstOrFail()
  }

  private orderData(intent: PaymentIntent) {
    const metadata = intent.metadata || {}
    return {
      id: intent.uniqueId,
      reference_id: intent.businessReferenceId,
      payment_status: intent.status,
      order_status: metadata.order_status || 'pending',
      amount: Number(intent.fiatAmount),
      currency: metadata.fiat_currency || intent.fiatCurrencyId,
      customer: {
        id: intent.customerId,
        email: intent.customerEmail,
        phone: metadata.customer_phone || metadata.delivery_address?.phone || null,
      },
      items: metadata.items || [],
      delivery_address: metadata.delivery_address || null,
      delivery_state: metadata.delivery_state || null,
      created_at: intent.createdAt,
      paid_at: intent.completedAt || intent.receivedPaymentAt || null,
      updated_at: intent.updatedAt,
    }
  }

  public async index({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const page = Math.max(1, Number(request.input('page', 1)) || 1)
      const limit = Math.min(100, Math.max(1, Number(request.input('limit', 20)) || 20))
      const status = request.input('status') as OrderStatus | undefined

      const query = PaymentIntent.query()
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .orderBy('createdAt', 'desc')
      if (status && ORDER_STATUSES.includes(status)) {
        query.whereRaw("metadata->>'order_status' = ?", [status])
      }

      const orders = await query.paginate(page, limit)
      return response.ok(formatSuccessMessage('Orders retrieved', {
        ...orders.toJSON(),
        data: orders.all().map((order) => this.orderData(order)),
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  public async show({ auth, request, response, params }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const order = await PaymentIntent.query()
        .where('uniqueId', params.orderId)
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .firstOrFail()

      return response.ok(formatSuccessMessage('Order retrieved', this.orderData(order)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  public async updateStatus({ auth, request, response, params }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const status = String(request.input('status', '')).toLowerCase() as OrderStatus
      if (!ORDER_STATUSES.includes(status)) {
        throw new Error(`status must be one of: ${ORDER_STATUSES.join(', ')}`)
      }

      const order = await PaymentIntent.query()
        .where('uniqueId', params.orderId)
        .where('businessId', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .firstOrFail()
      order.metadata = { ...(order.metadata || {}), order_status: status, order_status_updated_at: DateTime.now().toISO() }
      await order.save()

      return response.ok(formatSuccessMessage('Order status updated', this.orderData(order)))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  public async analytics({ auth, request, response }: HttpContextContract) {
    try {
      const userId = this.allowOnlyLoggedInUsers(auth)
      const shop = await this.getShop(userId, request.input('shop_id'))
      const now = DateTime.now()
      const start = request.input('from')
        ? DateTime.fromISO(String(request.input('from'))).startOf('day')
        : now.minus({ days: 30 }).startOf('day')
      const end = request.input('to')
        ? DateTime.fromISO(String(request.input('to'))).endOf('day')
        : now.endOf('day')
      const groupBy = String(request.input('group_by', 'day')).toLowerCase()

      const summaryRows = await Database.from('payment_intent_tb')
        .where('business_id', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .whereBetween('created_at', [start.toISO()!, end.toISO()!])
        .select(
          Database.raw("COALESCE(metadata->>'order_status', 'pending') AS order_status"),
          Database.raw('COUNT(*) AS order_count'),
          Database.raw('COALESCE(SUM(fiat_amount), 0) AS total_amount')
        )
        .groupByRaw("COALESCE(metadata->>'order_status', 'pending')")

      const byStatus: Record<string, { count: number; amount: number }> = {}
      for (const row of summaryRows) {
        byStatus[String(row.order_status)] = { count: Number(row.order_count), amount: Number(row.total_amount) }
      }

      const dateTrunc = groupBy === 'week'
        ? "DATE_TRUNC('week', created_at)"
        : groupBy === 'month'
          ? "DATE_TRUNC('month', created_at)"
          : "DATE_TRUNC('day', created_at)"

      const timeSeriesRows = await Database.from('payment_intent_tb')
        .where('business_id', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .whereBetween('created_at', [start.toISO()!, end.toISO()!])
        .select(
          Database.raw(`${dateTrunc} AS period`),
          Database.raw('COUNT(*) AS order_count'),
          Database.raw('COALESCE(SUM(fiat_amount), 0) AS total_amount')
        )
        .groupByRaw(`${dateTrunc}`)
        .orderBy('period', 'asc')

      const timeSeries = timeSeriesRows.map((row) => ({
        period: row.period,
        order_count: Number(row.order_count),
        total_amount: Number(row.total_amount),
      }))

      const uniqueCustomers = await Database.from('payment_intent_tb')
        .where('business_id', shop.userId)
        .whereRaw("metadata->>'shop_id' = ?", [shop.uniqueId])
        .whereBetween('created_at', [start.toISO()!, end.toISO()!])
        .whereNotNull('customer_id')
        .countDistinct('customer_id as count')

      const linkClicks = await Database.from('payment_links')
        .where('business_id', shop.userId)
        .whereBetween('created_at', [start.toISO()!, end.toISO()!])
        .sum('usage_count as total_clicks')

      return response.ok(formatSuccessMessage('Shop analytics retrieved', {
        from: start.toISO(),
        to: end.toISO(),
        group_by: groupBy,
        total_orders: Object.values(byStatus).reduce((sum, item) => sum + item.count, 0),
        total_revenue: Object.values(byStatus).reduce((sum, item) => sum + item.amount, 0),
        unique_customers: Number((uniqueCustomers as any)[0]?.count || 0),
        link_clicks: Number((linkClicks as any)[0]?.total_clicks || 0),
        by_status: byStatus,
        time_series: timeSeries,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}

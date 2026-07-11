import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import PaymentIntent from 'App/Models/PaymentIntent'
import Transfer from 'App/Models/Transfer'
import UserWallet from 'App/Models/UserWallet'
import BusinessSetting from 'App/Models/BusinessSetting'
import { PaymentIntentStatus } from 'App/Lib/types'
import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'

export default class DashboardStatsController {
  public async stats({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('user').user
      if (!user) {
        throw new Error('Authentication error!')
      }

      const [walletBalanceResult, payoutResult, paymentProcessedResult] = await Promise.all([
        UserWallet.query()
          .where('status', 'active')
          .sum('balance as total')
          .first(),

        Transfer.query()
          .where('status', 'completed')
          .sum('naira_amount as total')
          .first(),

        PaymentIntent.query()
          .where('status', PaymentIntentStatus.PAYMENT_COMPLETED)
          .sum('fiat_amount as total')
          .first(),
      ])

      const totalWalletBalance = Number(walletBalanceResult?.$extras?.total || 0)
      const totalPayout = Number(payoutResult?.$extras?.total || 0)
      const totalPaymentProcessed = Number(paymentProcessedResult?.$extras?.total || 0)

      return response.status(200).json(
        await formatSuccessMessage('Dashboard stats retrieved successfully', {
          totalWalletBalance,
          totalPayout,
          totalPaymentProcessed,
        })
      )
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async payoutChart({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('user').user
      if (!user) {
        throw new Error('Authentication error!')
      }

      // Pending payouts: transfers owned by this user with status = pending
      const pendingResult = await Transfer.query()
        .where('senderUserId', user.id)
        .where('status', 'pending')
        .sum('naira_amount as total')
        .first()

      // Processing payouts: transfers owned by this user with status = processing
      const processingResult = await Transfer.query()
        .where('senderUserId', user.id)
        .where('status', 'processing')
        .sum('naira_amount as total')
        .first()

      // Current pending interval: pending transfers within the business's payout interval window
      const businessSetting = await BusinessSetting.query()
        .where('businessId', user.uniqueId)
        .first()

      let intervalStart = DateTime.now().startOf('day') // default: today (INSTANT / fallback)
      if (businessSetting?.payoutInterval === 'WEEKLY') {
        intervalStart = DateTime.now().startOf('week')
      } else if (businessSetting?.payoutInterval === 'DAILY') {
        intervalStart = DateTime.now().startOf('day')
      }

      const intervalResult = await Transfer.query()
        .where('senderUserId', user.id)
        .where('status', 'pending')
        .where('created_at', '>=', intervalStart.toSQL()!)
        .sum('naira_amount as total')
        .first()

      const pendingPayout = Number(pendingResult?.$extras?.total || 0)
      const processingPayout = Number(processingResult?.$extras?.total || 0)
      const currentPendingInterval = Number(intervalResult?.$extras?.total || 0)

      const total = pendingPayout + processingPayout + currentPendingInterval

      return response.status(200).json(
        formatSuccessMessage('Payout chart data retrieved successfully', {
          total,
          breakdown: [
            { label: 'Pending payout', value: pendingPayout, color: '#a8f0a0' },
            { label: 'Processing payout', value: processingPayout, color: '#d4b896' },
            { label: 'Current pending interval', value: currentPendingInterval, color: '#b0a8d8' },
          ],
        })
      )
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * GET /dashboard/analytical-transactions
   *
   * Query params:
   *   period = 'week' (default) | 'month'
   *   year   = 2026  (optional, defaults to current year)
   *   month  = 6     (optional 1-12, only used when period=month, defaults to current month)
   *
   * week  → 7 bars, one per day: Mon … Sun of the specified/current week
   * month → one bar per day of the specified/current month
   */
  public async analyticalTransactions({ auth, request, response }: HttpContextContract) {
    try {
      const user = auth.use('user').user
      if (!user) throw new Error('Authentication error!')

      const period = (request.input('period', 'week') as string).toLowerCase()
      const now = DateTime.now()
      const year = Number(request.input('year', now.year))
      const month = Number(request.input('month', now.month))

      let start: DateTime
      let end: DateTime
      let labels: { key: string; label: string }[]

      if (period === 'month') {
        // Full calendar month
        start = DateTime.fromObject({ year, month, day: 1 }).startOf('day')
        end = start.endOf('month')

        const daysInMonth = end.day
        labels = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          return { key: String(day), label: String(day) }
        })
      } else {
        // Current ISO week (Mon–Sun)
        start = now.startOf('week')
        end = now.endOf('week')

        labels = [
          { key: '1', label: 'Mon' },
          { key: '2', label: 'Tues' },
          { key: '3', label: 'Wed' },
          { key: '4', label: 'Thur' },
          { key: '5', label: 'Fri' },
          { key: '6', label: 'Sat' },
          { key: '7', label: 'Sun' },
        ]
      }

      // Aggregate payment_intent_tb rows for this user in the window
      // Group by ISO day-of-week (1=Mon…7=Sun) for week, or day-of-month for month
      const extractFn = period === 'month' ? 'day' : 'isodow'

      const rows = await Database.from('payment_intent_tb')
        .where('business_id', user.uniqueId)
        .whereBetween('created_at', [start.toISO()!, end.toISO()!])
        .select(
          Database.raw(`EXTRACT(${extractFn} FROM created_at)::int AS period_key`),
          Database.raw('COUNT(*) AS transaction_count'),
          Database.raw('COALESCE(SUM(fiat_amount), 0) AS total_amount')
        )
        .groupByRaw(`EXTRACT(${extractFn} FROM created_at)::int`)
        .orderByRaw(`EXTRACT(${extractFn} FROM created_at)::int`)

      // Build a lookup map from the DB results
      const map: Record<string, { count: number; amount: number }> = {}
      for (const row of rows) {
        map[String(row.period_key)] = {
          count: Number(row.transaction_count),
          amount: Number(row.total_amount),
        }
      }

      // Fill all labels, zero for days with no data
      const data = labels.map(({ key, label }) => ({
        label,
        count: map[key]?.count ?? 0,
        amount: map[key]?.amount ?? 0,
      }))

      const totalCount = data.reduce((s, d) => s + d.count, 0)
      const totalAmount = data.reduce((s, d) => s + d.amount, 0)

      return response.status(200).json(
        formatSuccessMessage('Analytical transactions retrieved successfully', {
          period,
          year,
          ...(period === 'month' ? { month } : {}),
          total_count: totalCount,
          total_amount: totalAmount,
          data,
        })
      )
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }
}

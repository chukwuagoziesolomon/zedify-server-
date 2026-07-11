import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import Transfer from 'App/Models/Transfer'
import UserWallet from 'App/Models/UserWallet'
import { RecipientType, TransferStatus } from 'App/Models/Transfer'

export default class PayoutHistoryController {
  /**
   * GET /api/user/payout/history
   * Get payout history with type filtering: all | crypto | fiat
   *
   * Query params:
   *   type = 'all' (default) | 'crypto' | 'fiat'
   *   status = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' (optional)
   *   page = 1
   *   limit = 20
   */
  public async history({ auth, request, response }: HttpContextContract) {
    try {
      const userId = auth.user!.id
      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20
      const type = String(request.input('type', 'all')).toLowerCase()
      const status = request.input('status')

      const query = Transfer.query().where('senderUserId', userId)

      if (type === 'crypto') {
        query.where('recipientType', RecipientType.USER_USDT)
      } else if (type === 'fiat') {
        query.where('recipientType', RecipientType.BANK_ACCOUNT)
      }

      if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(String(status))) {
        query.where('status', String(status))
      }

      const transfers = await query
        .orderBy('initiatedAt', 'desc')
        .paginate(page, limit)

      const transfersWithDetails = await Promise.all(
        transfers.all().map(async (transfer: Transfer) => {
          let cryptoCurrency: string | null = null
          let walletAddress: string | null = null

          if (transfer.userWalletId) {
            const wallet = await UserWallet.query()
              .where('id', transfer.userWalletId)
              .preload('currency')
              .first()
            if (wallet) {
              walletAddress = wallet.walletAddress
              cryptoCurrency = wallet.currency?.symbol || null
            }
          }

          const method =
            transfer.recipientType === RecipientType.BANK_ACCOUNT
              ? 'Fiat'
              : transfer.recipientType === RecipientType.USER_USDT
                ? 'Crypto'
                : 'Other'

          return {
            id: transfer.uniqueId,
            paid_on: transfer.completedAt?.toFormat('dd MMM. yyyy') || transfer.initiatedAt?.toFormat('dd MMM. yyyy') || transfer.createdAt.toFormat('dd MMM. yyyy'),
            method,
            crypto_currency: cryptoCurrency,
            wallet: walletAddress,
            amount: Number(transfer.nairaAmount || 0),
            status: transfer.status,
          }
        })
      )

      const summary = await this.getSummary(userId)

      Logger.info(`[PayoutHistory] Retrieved payouts for user ${userId}: type=${type}, page=${page}`)

      return response.ok({
        success: true,
        data: {
          data: transfersWithDetails,
          meta: {
            total: transfers.total,
            per_page: transfers.perPage,
            current_page: transfers.currentPage,
            last_page: transfers.lastPage,
          },
        },
        summary,
      })
    } catch (error) {
      Logger.error(`[PayoutHistory] Failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve payout history',
        error: (error as any).message,
      })
    }
  }

  private async getSummary(userId: number) {
    const [totalResult, pendingResult, processingResult, intervalResult] = await Promise.all([
      Transfer.query()
        .where('senderUserId', userId)
        .where('status', TransferStatus.COMPLETED)
        .sum('naira_amount as total')
        .first(),
      Transfer.query()
        .where('senderUserId', userId)
        .where('status', TransferStatus.PENDING)
        .sum('naira_amount as total')
        .first(),
      Transfer.query()
        .where('senderUserId', userId)
        .where('status', TransferStatus.PROCESSING)
        .sum('naira_amount as total')
        .first(),
      Transfer.query()
        .where('senderUserId', userId)
        .where('status', TransferStatus.PENDING)
        .sum('naira_amount as total')
        .first(),
    ])

    const totalPayout = Number(totalResult?.$extras?.total || 0)
    const pendingPayout = Number(pendingResult?.$extras?.total || 0)
    const processingPayout = Number(processingResult?.$extras?.total || 0)
    const currentPendingInterval = Number(intervalResult?.$extras?.total || 0)

    return {
      total_payout: totalPayout,
      pending_payout: pendingPayout + processingPayout,
      current_pending_interval: currentPendingInterval,
    }
  }
}

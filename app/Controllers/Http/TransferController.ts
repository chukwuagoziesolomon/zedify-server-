import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import Transfer from 'App/Models/Transfer'
import UserWallet from 'App/Models/UserWallet'
import TransferService from 'App/Services/TransferService'
import ConversionService from 'App/Services/ConversionService'
import CoinGeckoService from 'App/Services/CoinGeckoService'
import Currency from 'App/Models/Currency'
import SseService from 'App/Services/SseService'

/**
 * TransferController
 * Handles user USDT transfer operations:
 * - Initiate transfers to bank accounts, other users, or merchants
 * - View transfer history
 * - Cancel pending transfers
 * - Get conversion rates
 */
export default class TransferController {
  /**
   * GET /api/user/transfers
   * Get user's transfer history with pagination
   */
  async getTransfers({ auth, request, response }: HttpContextContract) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status') // optional filter

      const query = Transfer.query().where('senderUserId', auth.user!.id)

      if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
        query.where('status', status)
      }

      const transfers = await query
        .orderBy('initiatedAt', 'desc')
        .paginate(page, limit)

      Logger.info(`[TransferController] Retrieved transfers for user ${auth.user!.id}: page ${page}`)

      return response.ok({
        success: true,
        data: transfers,
      })
    } catch (error) {
      Logger.error(`[TransferController] Get transfers failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve transfers',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/withdrawals/history
   * Get withdrawal history for the logged-in user.
   */
  async getWithdrawalHistory({ auth, request, response }: HttpContextContract) {
    try {
      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20
      const status = request.input('status')

      const query = Transfer.query().where('senderUserId', auth.user!.id)

      if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(String(status))) {
        query.where('status', String(status))
      }

      const withdrawals = await query.orderBy('createdAt', 'desc').paginate(page, limit)

      return response.ok({
        success: true,
        data: withdrawals,
      })
    } catch (error) {
      Logger.error(`[TransferController] Get withdrawal history failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve withdrawal history',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/transfers/:id
   * Get transfer details
   */
  async getTransfer({ auth, response, params }: HttpContextContract) {
    try {
      const transfer = await Transfer.query()
        .where('uniqueId', params.id)
        .where('senderUserId', auth.user!.id)
        .first()

      if (!transfer) {
        return response.notFound({
          success: false,
          message: 'Transfer not found',
        })
      }

      Logger.info(`[TransferController] Retrieved transfer ${params.id} for user ${auth.user!.id}`)

      return response.ok({
        success: true,
        data: transfer,
      })
    } catch (error) {
      Logger.error(`[TransferController] Get transfer failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve transfer',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/transfer/rate
   * Get current USDT → NGN exchange rate
   */
  async getExchangeRate({ response }: HttpContextContract) {
    try {
      const rate = await ConversionService.getCurrentExchangeRate()

      Logger.info(`[TransferController] Retrieved exchange rate: 1 USDT = ${rate} NGN`)

      return response.ok({
        success: true,
        data: {
          fromCurrency: 'USDT',
          toCurrency: 'NGN',
          rate: rate,
          message: `1 USDT = ₦${rate.toFixed(2)}`,
        },
      })
    } catch (error) {
      Logger.error(`[TransferController] Get exchange rate failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to get exchange rate',
        error: (error as any).message,
      })
    }
  }

  /**
   * POST /api/user/transfer/quote
   * Get conversion estimate before transfer (doesn't deduct balance)
   */
  async getConversionQuote({ request, response }: HttpContextContract) {
    try {
      const usdtAmount = request.input('usdtAmount')

      if (!usdtAmount || usdtAmount <= 0) {
        return response.badRequest({
          success: false,
          message: 'USDT amount must be greater than 0',
        })
      }

      const isValid = await ConversionService.validateConversion(usdtAmount)
      if (!isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid amount for conversion',
        })
      }

      const conversion = await ConversionService.convertUsdtToNaira(usdtAmount)

      Logger.info(`[TransferController] Generated quote: ${usdtAmount} USDT`)

      return response.ok({
        success: true,
        data: {
          usdtAmount: conversion.fromAmount,
          exchangeRate: conversion.exchangeRate,
          nairaAmount: conversion.toAmount,
          fee: (usdtAmount * 0.01).toFixed(6), // 1% fee
          message: `${conversion.fromAmount} USDT ≈ ₦${conversion.toAmount.toFixed(2)} (after 1% fee)`,
        },
      })
    } catch (error) {
      Logger.error(`[TransferController] Get conversion quote failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to get conversion quote',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/prices
   * Get real-time crypto and fiat prices from CoinGecko
   * Query: symbols=CKB,USDT,USDC,NGN (comma-separated, optional)
   */
  async getPrices({ request, response }: HttpContextContract) {
    try {
      const symbolsParam = request.input('symbols', 'CKB,USDT,USDC,NGN')
      const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

      if (symbols.length === 0) {
        return response.badRequest({
          success: false,
          message: 'At least one symbol is required',
        })
      }

      const prices = await CoinGeckoService.getPrices(symbols)

      return response.ok({
        success: true,
        data: prices,
        cached: false, // CoinGeckoService handles caching internally
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      Logger.error(`[TransferController] Get prices failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch prices',
        error: (error as any).message,
      })
    }
  }

  /**
   * POST /api/user/transfer/initiate
   * Initiate a USDT transfer
   * 
   * Body:
   * {
   *   userWalletId: string,
   *   usdtAmount: number,
   *   recipientType: 'bank_account' | 'user_usdt' | 'merchant',
   *   recipientName?: string,
   *   recipientAccountNumber?: string (for bank_account),
   *   recipientBankCode?: string (for bank_account),
   *   recipientUserId?: string (for user_usdt),
   *   recipientReference?: string (for merchant),
   *   purpose?: string
   * }
   */
  async initiateTransfer({ auth, request, response }: HttpContextContract) {
    try {
      const userId = auth.user!.id
      const {
        userWalletId,
        usdtAmount,
        recipientType,
        recipientName,
        recipientAccountNumber,
        recipientBankCode,
        recipientUserId,
        recipientReference,
        purpose,
      } = request.all()

      // Validate required fields
      if (!userWalletId || !usdtAmount || !recipientType) {
        return response.badRequest({
          success: false,
          message: 'Missing required fields: userWalletId, usdtAmount, recipientType',
        })
      }

      // Validate recipient type
      if (!['bank_account', 'user_usdt', 'merchant'].includes(recipientType)) {
        return response.badRequest({
          success: false,
          message: 'Invalid recipientType. Must be: bank_account, user_usdt, or merchant',
        })
      }

      // Validate recipient details
      if (recipientType === 'bank_account') {
        if (!recipientAccountNumber || !recipientBankCode) {
          return response.badRequest({
            success: false,
            message: 'Bank transfer requires recipientAccountNumber and recipientBankCode',
          })
        }
      } else if (recipientType === 'user_usdt') {
        if (!recipientUserId) {
          return response.badRequest({
            success: false,
            message: 'User transfer requires recipientUserId',
          })
        }
      } else if (recipientType === 'merchant') {
        if (!recipientReference) {
          return response.badRequest({
            success: false,
            message: 'Merchant transfer requires recipientReference',
          })
        }
      }

      // Validate amount
      if (usdtAmount <= 0) {
        return response.badRequest({
          success: false,
          message: 'Amount must be greater than 0',
        })
      }

      // Validate wallet ownership
      const wallet = await UserWallet.query()
        .where('id', userWalletId)
        .where('userId', userId)
        .where('status', 'active')
        .first()

      if (!wallet) {
        return response.notFound({
          success: false,
          message: 'Wallet not found or inactive',
        })
      }

      Logger.info(
        `[TransferController] Initiating transfer for user ${userId}: ${usdtAmount} USDT to ${recipientType}`
      )

      // Initiate transfer
      const result = await TransferService.initiateTransfer({
        userId: auth.user!.id,
        userWalletId: parseInt(userWalletId),
        usdtAmount,
        recipientType,
        recipientName,
        recipientAccountNumber,
        recipientBankCode,
        recipientUserId: recipientUserId ? parseInt(recipientUserId) : undefined,
        recipientReference,
        purpose,
      })

      // Emit SSE: withdrawal.created
      SseService.emit(String(auth.user!.id), {
        event: 'withdrawal.created',
        data: {
          transfer_id: (result as any)?.uniqueId ?? null,
          usdt_amount: usdtAmount,
          recipient_type: recipientType,
          status: 'pending',
        },
      })

      return response.created({
        success: true,
        data: result,
        message: 'Transfer initiated successfully',
      })
    } catch (error) {
      Logger.error(`[TransferController] Initiate transfer failed: ${error}`)
      return response.badRequest({
        success: false,
        message: (error as any).message || 'Failed to initiate transfer',
        error: (error as any).message,
      })
    }
  }

  /**
   * POST /api/user/transfer/:id/cancel
   * Cancel a pending transfer (refund USDT to wallet)
   */
  async cancelTransfer({ auth, response, params }: HttpContextContract) {
    try {
      const userId = auth.user!.id
      const transferId = params.id

      Logger.info(
        `[TransferController] Cancelling transfer ${transferId} for user ${userId}`
      )

      // Verify transfer exists and belongs to user
      const transfer = await Transfer.query()
        .where('uniqueId', transferId)
        .where('senderUserId', userId)
        .first()

      if (!transfer) {
        return response.notFound({
          success: false,
          message: 'Transfer not found',
        })
      }

      if (transfer.status !== 'pending') {
        return response.badRequest({
          success: false,
          message: `Cannot cancel transfer with status: ${transfer.status}. Only pending transfers can be cancelled.`,
        })
      }

      // Cancel transfer
      await TransferService.cancelTransfer(transferId, auth.user!.id)

      return response.ok({
        success: true,
        data: { transferId, status: 'cancelled' },
        message: 'Transfer cancelled and refunded',
      })
    } catch (error) {
      Logger.error(`[TransferController] Cancel transfer failed: ${error}`)
      return response.badRequest({
        success: false,
        message: (error as any).message || 'Failed to cancel transfer',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/wallets
   * Get user's USDT wallets across different networks
   */
  async getWallets({ auth, response }: HttpContextContract) {
    try {
      const wallets = await UserWallet.query()
        .where('userId', auth.user!.id)
        .where('status', '!=', 'archived')
        .preload('cryptoNetwork')
        .preload('currency')
        .orderBy('createdAt', 'desc')

      Logger.info(`[TransferController] Retrieved ${wallets.length} wallets for user ${auth.user!.id}`)

      return response.ok({
        success: true,
        data: wallets,
      })
    } catch (error) {
      Logger.error(`[TransferController] Get wallets failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve wallets',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/wallets/:id
   * Get wallet balance and details
   */
  async getWallet({ auth, response, params }: HttpContextContract) {
    try {
      const wallet = await UserWallet.query()
        .where('id', params.id)
        .where('userId', auth.user!.id)
        .preload('cryptoNetwork')
        .preload('currency')
        .first()

      if (!wallet) {
        return response.notFound({
          success: false,
          message: 'Wallet not found',
        })
      }

      Logger.info(
        `[TransferController] Retrieved wallet ${params.id} for user ${auth.user!.id}`
      )

      return response.ok({
        success: true,
        data: wallet,
      })
    } catch (error) {
      Logger.error(`[TransferController] Get wallet failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve wallet',
        error: (error as any).message,
      })
    }
  }

  /**
   * GET /api/user/wallet/balance
   * Returns the total wallet balance across all active wallets,
   * plus a per-wallet breakdown with USD and NGN equivalents.
   * The balance field is already kept up to date by the payment indexer
   * whenever a payment is confirmed, so polling this endpoint every
   * 15–30 seconds gives the frontend a "near real-time" view without
   * needing WebSockets.
   */
  async getWalletBalance({ auth, response }: HttpContextContract) {
    try {
      const wallets = await UserWallet.query()
        .where('userId', auth.user!.id)
        .where('status', 'active')
        .preload('cryptoNetwork')
        .preload('currency')

      const walletBreakdown = await Promise.all(
        wallets.map(async (w) => {
          const currency = await Currency.query()
            .where('uniqueId', w.currencyId)
            .first()

          const ratePerUsd = Number(currency?.ratePerUsd || 0)
          const balanceUsd = ratePerUsd > 0 ? Number(w.balance) / ratePerUsd : 0

          let balanceNgn = 0
          try {
            const conversion = await ConversionService.convertUsdtToNaira(balanceUsd)
            balanceNgn = conversion.toAmount
          } catch (_) {
            balanceNgn = 0
          }

          return {
            wallet_id: w.uniqueId,
            address: w.walletAddress,
            balance: Number(w.balance),
            balance_usd: parseFloat(balanceUsd.toFixed(6)),
            balance_ngn: parseFloat(balanceNgn.toFixed(2)),
            total_deposited: Number(w.totalDeposited),
            total_withdrawn: Number(w.totalWithdrawn),
            currency: currency
              ? {
                  id: currency.uniqueId,
                  name: currency.name,
                  symbol: currency.symbol,
                  logo: currency.logo || null,
                }
              : null,
            network: w.cryptoNetwork
              ? {
                  id: w.cryptoNetwork.uniqueId,
                  name: w.cryptoNetwork.name,
                  logo: w.cryptoNetwork.logo || null,
                  is_testnet: Boolean(w.cryptoNetwork.isTestnet),
                }
              : null,
          }
        })
      )

      const totalBalanceUsd = walletBreakdown.reduce((s, w) => s + w.balance_usd, 0)
      const totalBalanceNgn = walletBreakdown.reduce((s, w) => s + w.balance_ngn, 0)

      return response.ok({
        success: true,
        data: {
          total_balance_usd: parseFloat(totalBalanceUsd.toFixed(6)),
          total_balance_ngn: parseFloat(totalBalanceNgn.toFixed(2)),
          wallets: walletBreakdown,
        },
      })
    } catch (error) {
      Logger.error(`[TransferController] Get wallet balance failed: ${error}`)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve wallet balance',
        error: (error as any).message,
      })
    }
  }
}

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import PaymentIntent from 'App/Models/PaymentIntent'
import Wallet from 'App/Models/Wallet'
import Currency from 'App/Models/Currency'
import FiberInvoice from 'App/Models/FiberInvoice'
import { PaymentIntentStatus } from 'App/Lib/types'
import CurrencyController from './CurrencyController'

/** How long in ms between SSE heartbeats / status re-checks */
const SSE_POLL_INTERVAL_MS = 4_000
/** Maximum duration to hold an SSE connection open (5 minutes) */
const SSE_MAX_DURATION_MS = 5 * 60_000

/**
 * PaymentStatusController
 *
 * Provides two public (no auth required) endpoints for payment widgets:
 *
 * GET /api/payment/status/:reference_id
 *   One-shot JSON status snapshot — good for simple polling.
 *
 * GET /api/payment/status/:reference_id/stream
 *   Server-Sent Events stream — the widget connects once and receives
 *   status push events until the payment completes or times out.
 */
export default class PaymentStatusController {
  /**
   * GET /api/payment/status/:reference_id
   *
   * Returns the current snapshot of a payment intent.
   * Safe to call every few seconds from a payment widget.
   */
  async status({ params, response }: HttpContextContract) {
    try {
      const { reference_id } = params
      const snapshot = await this.buildStatusSnapshot(reference_id)

      if (!snapshot) {
        return response.notFound({ error: true, message: 'Payment intent not found' })
      }

      return response.ok({ error: false, data: snapshot })
    } catch (error) {
      Logger.error(`[PaymentStatus] status error: ${error}`)
      return response.internalServerError({ error: true, message: 'Failed to fetch payment status' })
    }
  }

  /**
   * GET /api/payment/status/:reference_id/stream
   *
   * Server-Sent Events (SSE) endpoint.
   * The payment widget subscribes here and receives push events:
   *   - "status" events whenever the payment status changes
   *   - "heartbeat" events every ~4s while waiting
   *   - "complete" event (and connection close) when payment is finalised
   *   - "timeout" event if the connection is held past SSE_MAX_DURATION_MS
   */
  async stream({ params, response, request }: HttpContextContract) {
    const { reference_id } = params

    // Set SSE headers
    response.response.setHeader('Content-Type', 'text/event-stream')
    response.response.setHeader('Cache-Control', 'no-cache')
    response.response.setHeader('Connection', 'keep-alive')
    response.response.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
    response.response.flushHeaders()

    const send = (event: string, data: object) => {
      try {
        response.response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {
        // Client disconnected — ignore
      }
    }

    let lastStatus: PaymentIntentStatus | null = null
    let elapsed = 0

    const timer = setInterval(async () => {
      elapsed += SSE_POLL_INTERVAL_MS

      // Check if client is still connected
      if (request.request.destroyed) {
        clearInterval(timer)
        return
      }

      if (elapsed >= SSE_MAX_DURATION_MS) {
        send('timeout', { message: 'Payment session timed out' })
        clearInterval(timer)
        response.response.end()
        return
      }

      try {
        const snapshot = await this.buildStatusSnapshot(reference_id)

        if (!snapshot) {
          send('error', { message: 'Payment intent not found' })
          clearInterval(timer)
          response.response.end()
          return
        }

        // Only push when status actually changes
        if (snapshot.status !== lastStatus) {
          lastStatus = snapshot.status as PaymentIntentStatus
          send('status', snapshot)

          // Close stream once payment reaches a terminal state
          if (
            snapshot.status === PaymentIntentStatus.PAYMENT_COMPLETED ||
            snapshot.status === PaymentIntentStatus.INCOMPLETE_PAYMENT
          ) {
            send('complete', { status: snapshot.status })
            clearInterval(timer)
            response.response.end()
            return
          }
        } else {
          // Send heartbeat so the connection stays alive through proxies
          send('heartbeat', { elapsed_ms: elapsed })
        }
      } catch (err) {
        Logger.warn(`[PaymentStatus] SSE check error for ${reference_id}: ${err}`)
        send('error', { message: 'Status check failed' })
      }
    }, SSE_POLL_INTERVAL_MS)

    // Send initial snapshot immediately on connect
    try {
      const initial = await this.buildStatusSnapshot(reference_id)
      if (initial) {
        lastStatus = initial.status as PaymentIntentStatus
        send('status', initial)
      } else {
        send('error', { message: 'Payment intent not found' })
        clearInterval(timer)
        response.response.end()
      }
    } catch (err) {
      Logger.error(`[PaymentStatus] Initial SSE snapshot error: ${err}`)
      send('error', { message: 'Failed to load payment intent' })
      clearInterval(timer)
      response.response.end()
    }

    // Clean up if the client disconnects
    request.request.on('close', () => {
      clearInterval(timer)
    })
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a full status snapshot for a reference_id.
   * Returns null if not found.
   */
  private async buildStatusSnapshot(referenceId: string) {
    const intent = await PaymentIntent.query()
      .where('businessReferenceId', referenceId)
      .first()

    if (!intent) return null

    let walletInfo: { address: string; qr_code: string | null } | null = null
    let cryptoInfo: {
      name: string
      symbol: string
      logo: string
      amount: number
      contract_address: string | null
      network: { name: string; logo: string; chain_id: number | null } | null
    } | null = null

    if (intent.walletId) {
      const wallet = await Wallet.query().where('uniqueId', intent.walletId).first()
      if (wallet) {
        walletInfo = {
          address: wallet.walletAddress,
          qr_code: wallet.qrCodeUrl ?? null,
        }
      }
    }

    if (intent.cryptoCurrencyId) {
      const currency = await Currency.query()
        .where('uniqueId', intent.cryptoCurrencyId)
        .preload('cryptoNetwork')
        .first()

      if (currency) {
        let cryptoAmount = intent.feeInCrypto ?? 0

        // If feeInCrypto not yet set, calculate live
        if (!cryptoAmount) {
          try {
            cryptoAmount = await CurrencyController.calculateCryptoEquivalent({
              fiatCurrencyId: intent.fiatCurrencyId,
              fiatAmount: intent.fiatAmount,
              cryptoCurrencyId: currency.uniqueId,
            })
          } catch {
            cryptoAmount = 0
          }
        }

        const network = currency.cryptoNetwork
        cryptoInfo = {
          name: currency.name,
          symbol: currency.symbol,
          logo: currency.logo,
          amount: cryptoAmount,
          contract_address: currency.contractAddress,
          network: network
            ? { name: network.name, logo: network.logo, chain_id: network.chainId }
            : null,
        }
      }
    }

    return {
      reference_id: intent.businessReferenceId,
      payment_intent_id: intent.uniqueId,
      status: intent.status,
      fiat_amount: intent.fiatAmount,
      fiat_currency_id: intent.fiatCurrencyId,
      created_at: intent.createdAt,
      expires_at: await this.resolveExpiresAt(intent.uniqueId, intent.createdAt?.toISO()),
      received_payment_at: intent.receivedPaymentAt ?? null,
      completed_at: intent.completedAt ?? null,
      wallet: walletInfo,
      crypto: cryptoInfo,
    }
  }

  /**
   * Resolve expires_at for a payment intent.
   * Prefers FiberInvoice.expiresAt, falls back to createdAt + 1 hour.
   */
  private async resolveExpiresAt(paymentIntentId: string, createdAtIso?: string): Promise<string | null> {
    try {
      const invoice = await FiberInvoice.query()
        .where('paymentIntentId', paymentIntentId)
        .orderBy('createdAt', 'desc')
        .first()
      if (invoice?.expiresAt) {
        return invoice.expiresAt.toISO()
      }
    } catch { /* fall through */ }
    // Fallback: 1 hour from creation
    if (createdAtIso) {
      const { DateTime } = require('luxon')
      return DateTime.fromISO(createdAtIso).plus({ hours: 1 }).toISO()
    }
    return null
  }
}

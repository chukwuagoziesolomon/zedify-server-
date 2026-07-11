import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import axios from 'axios'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import BusinessSetting from 'App/Models/BusinessSetting'
import WebhookLog from 'App/Models/WebhookLog'
import { genRandomUuid } from 'App/helpers/utils'
import { CurrentEnvironment } from 'App/Lib/types'
import Env from '@ioc:Adonis/Core/Env'

export type WebhookEvent =
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.pending'
  | 'payout.completed'
  | 'payout.failed'

export interface WebhookPayload {
  event: WebhookEvent
  environment: 'LIVE' | 'TEST'
  timestamp: string
  data: Record<string, any>
}

const MAX_RETRIES = 3
const TIMEOUT_MS = 10_000

/**
 * WebhookDispatcherService
 *
 * Responsibilities:
 * - Signs every outbound payload with the merchant's own HMAC-SHA256 secret
 * - Retries with exponential back-off (1s, 2s, 4s)
 * - Logs every attempt to webhook_logs table
 * - Provides a "verify" helper to test a URL before saving
 */
class WebhookDispatcherServiceClass {
  /**
   * Generate a new random 32-byte hex signing secret for a merchant.
   */
  public generateSigningSecret(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Sign a JSON string with a merchant's secret using HMAC-SHA256.
   * Returns  "sha256=<hex>"  — same format as GitHub/Stripe webhooks.
   */
  public sign(body: string, secret: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  }

  /**
   * Constant-time signature verification — safe against timing attacks.
   */
  public verify(signature: string, body: string, secret: string): boolean {
    const expected = this.sign(body, secret)
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  /**
   * Send a webhook event to a merchant.
   * Automatically picks LIVE or TEST URL based on environment.
   * Logs every attempt.
   *
   * @param businessId - user.unique_id
   * @param event      - event name e.g. 'payment.confirmed'
   * @param data       - event-specific data object
   */
  public async dispatch(
    businessId: string,
    event: WebhookEvent,
    data: Record<string, any>
  ): Promise<void> {
    const setting = await BusinessSetting.query()
      .where('businessId', businessId)
      .first()

    if (!setting) {
      Logger.warn(`[Webhook] No business settings for ${businessId}`)
      return
    }

    const isProduction = Env.get('APP_ENV', 'development') === 'production'
    const environment: 'LIVE' | 'TEST' = isProduction ? CurrentEnvironment.LIVE : CurrentEnvironment.TEST
    const webhookUrl = isProduction ? setting.liveWebhookUrl : setting.testWebhookUrl

    if (!webhookUrl) {
      Logger.info(`[Webhook] No ${environment} webhook URL for business ${businessId} — skipping`)
      return
    }

    // Use merchant's own secret; fall back to global secret if not yet rotated
    const secret =
      setting.webhookSigningSecret ||
      Env.get('WEBHOOK_SECRET', 'change-me-in-production')

    const payload: WebhookPayload = {
      event,
      environment,
      timestamp: new Date().toISOString(),
      data,
    }

    await this.sendWithRetry(businessId, webhookUrl, environment, payload, secret)
  }

  /**
   * Test a webhook URL by sending a ping event.
   * Used before the merchant saves their URL — doesn't log to DB.
   *
   * @returns { ok: boolean, statusCode?: number, error?: string }
   */
  public async verify_url(
    url: string,
    secret: string
  ): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
    const payload: WebhookPayload = {
      event: 'payment.confirmed',
      environment: 'TEST',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a webhook connectivity test from WT Payments.',
      },
    }

    const body = JSON.stringify(payload)
    const signature = this.sign(body, secret)

    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-WT-Signature': signature,
          'X-WT-Event': payload.event,
          'X-WT-Timestamp': payload.timestamp,
        },
        timeout: TIMEOUT_MS,
        validateStatus: () => true, // don't throw on 4xx/5xx
      })

      return { ok: res.status >= 200 && res.status < 300, statusCode: res.status }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async sendWithRetry(
    businessId: string,
    webhookUrl: string,
    environment: string,
    payload: WebhookPayload,
    secret: string
  ): Promise<void> {
    const body = JSON.stringify(payload)
    const signature = this.sign(body, secret)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let statusCode: number | null = null
      let responseBody: string | null = null
      let success = false
      let errorMessage: string | null = null

      try {
        const res = await axios.post(webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-WT-Signature': signature,
            'X-WT-Event': payload.event,
            'X-WT-Timestamp': payload.timestamp,
          },
          timeout: TIMEOUT_MS,
          validateStatus: () => true,
        })

        statusCode = res.status
        responseBody = String(res.data ?? '').slice(0, 1000)
        success = res.status >= 200 && res.status < 300

        if (success) {
          await this.log({
            businessId, event: payload.event, webhookUrl, environment,
            payload, statusCode, responseBody, attempt, success, errorMessage: null,
            deliveredAt: DateTime.now(),
          })
          Logger.info(`[Webhook] Delivered ${payload.event} to ${webhookUrl} (attempt ${attempt})`)
          return
        }

        errorMessage = `HTTP ${statusCode}`
      } catch (error: any) {
        errorMessage = error.message
      }

      // Log failed attempt
      await this.log({
        businessId, event: payload.event, webhookUrl, environment,
        payload, statusCode, responseBody, attempt, success: false, errorMessage,
        deliveredAt: null,
      })

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
        Logger.warn(`[Webhook] Attempt ${attempt} failed for ${webhookUrl} — retrying in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      } else {
        Logger.error(`[Webhook] All ${MAX_RETRIES} attempts failed for ${webhookUrl}: ${errorMessage}`)
      }
    }
  }

  private async log(data: {
    businessId: string
    event: string
    webhookUrl: string
    environment: string
    payload: any
    statusCode: number | null
    responseBody: string | null
    attempt: number
    success: boolean
    errorMessage: string | null
    deliveredAt: DateTime | null
  }): Promise<void> {
    try {
      await WebhookLog.create({
        uniqueId: genRandomUuid(),
        ...data,
      })
    } catch (err) {
      Logger.error(`[Webhook] Failed to write log: ${err}`)
    }
  }
}

export default new WebhookDispatcherServiceClass()

import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { ConversationMessage } from 'App/Models/AiShopConversation'

export interface OpenRouterResponse {
  content: string | null
  reasoning_details?: any[]
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Rate limit tracking for adaptive backoff
 */
interface RateLimitTracker {
  lastResetTime: number
  requestCount: number
  baseDelay: number
}

class OpenRouterServiceClass {
  private readonly baseUrl = 'https://openrouter.ai/api/v1/chat/completions'
  private readonly rateLimitTrackers = new Map<string, RateLimitTracker>()
  private readonly MAX_RETRIES = 3
  private readonly INITIAL_BACKOFF_MS = 1000 // Start with 1s

  private get apiKey(): string {
    return Env.get('OPENROUTER_API_KEY', '')
  }

  private get model(): string {
    return Env.get('OPENROUTER_MODEL', 'moonshotai/kimi-k2.7-code')
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://wt-payments.com',
      'X-Title': 'WT Payments AI Shop Builder',
    }
  }

  /**
   * Get or initialize rate limit tracker for a model
   */
  private getRateLimitTracker(model: string): RateLimitTracker {
    if (!this.rateLimitTrackers.has(model)) {
      this.rateLimitTrackers.set(model, {
        lastResetTime: Date.now(),
        requestCount: 0,
        baseDelay: this.INITIAL_BACKOFF_MS,
      })
    }
    return this.rateLimitTrackers.get(model)!
  }

  /**
   * Calculate exponential backoff with jitter
   * Delay increases exponentially: 1s, 2s, 4s, 8s...
   * Plus random jitter (0-20% of base delay)
   */
  private calculateBackoffDelay(retryCount: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount)
    const jitter = Math.random() * (baseDelay * 0.2)
    return exponentialDelay + jitter
  }

  /**
   * Update rate limit tracker after request
   */
  private updateRateLimitTracker(model: string, isRateLimit: boolean): void {
    const tracker = this.getRateLimitTracker(model)
    const now = Date.now()

    // Reset every minute
    if (now - tracker.lastResetTime > 60000) {
      tracker.requestCount = 0
      tracker.lastResetTime = now
      tracker.baseDelay = this.INITIAL_BACKOFF_MS
    }

    tracker.requestCount++

    if (isRateLimit) {
      // Increase base delay on rate limit
      tracker.baseDelay = Math.min(tracker.baseDelay * 1.5, 10000) // Cap at 10s
      Logger.warn('[OpenRouter] Rate limit detected for %s. Base delay adjusted to: %dms', model, tracker.baseDelay)
    }
  }

  /**
   * Non-streaming chat with enhanced rate limit handling and multi-turn reasoning support.
   * Uses Kimi model with reasoning enabled for best results.
   * Implements exponential backoff with jitter for 429 rate limit errors.
   * Preserves reasoning_details across turns for multi-turn conversations.
   */
  public async chat(
    messages: ConversationMessage[],
    enableReasoning: boolean = true
  ): Promise<OpenRouterResponse> {
    return await this.callWithRetry(this.model, messages, enableReasoning, true)
  }

  /**
   * Wraps callModel with exponential backoff retry logic (up to MAX_RETRIES).
   * Handles 429 rate limits and 5xx server errors with adaptive backoff.
   */
  private async callWithRetry(
    model: string,
    messages: ConversationMessage[],
    enableReasoning: boolean,
    preserveReasoning: boolean,
    retryCount: number = 0
  ): Promise<OpenRouterResponse> {
    try {
      return await this.callModel(model, messages, enableReasoning, preserveReasoning)
    } catch (err: any) {
      const status = err.response?.status
      const isRetryable = status === 429 || (status >= 500 && status < 600)

      if (!isRetryable || retryCount >= this.MAX_RETRIES) {
        throw err
      }

      const tracker = this.getRateLimitTracker(model)
      const backoffDelay = this.calculateBackoffDelay(retryCount, tracker.baseDelay)
      this.updateRateLimitTracker(model, status === 429)

      const reason = status === 429 ? 'rate limit (429)' : `server error (${status})`
      Logger.warn(
        '[OpenRouter] %s on %s — retrying in %dms (attempt %d/%d)',
        reason,
        model,
        Math.round(backoffDelay),
        retryCount + 1,
        this.MAX_RETRIES
      )

      await sleep(backoffDelay)
      return this.callWithRetry(model, messages, enableReasoning, preserveReasoning, retryCount + 1)
    }
  }

  /**
   * Streaming chat with improved rate limit handling
   * Returns an async generator that yields token chunks one by one.
   * Falls back to non-streaming if the stream fails or rate limits.
   *
   * Usage:
   *   for await (const chunk of openRouterService.stream(messages)) {
   *     res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`)
   *   }
   */
  public async *stream(
    messages: ConversationMessage[],
    enableReasoning: boolean = true
  ): AsyncGenerator<string> {
    const body = {
      model: this.model,
      stream: true,
      messages: messages
        .filter((m) => m.content !== null && m.content !== undefined && String(m.content).trim() !== '')
        .map((m) => {
          const msg: any = { role: m.role, content: m.content }
          // Pass reasoning_details back for multi-turn continuation
          if (m.reasoning_details) {
            msg.reasoning_details = m.reasoning_details
          }
          return msg
        }),
      ...(enableReasoning ? { reasoning: { enabled: true } } : {}),
    }

    try {
      const res = await axios.post(this.baseUrl, body, {
        headers: this.headers,
        responseType: 'stream',
        timeout: 90000,
      })

      let buffer = ''

      for await (const rawChunk of res.data) {
        buffer += rawChunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const token = json?.choices?.[0]?.delta?.content
            if (token) yield token
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (error: any) {
      const status = error.response?.status
      const detail =
        error.response?.data?.error?.message ?? error.response?.data?.message ?? error.message

      if (status === 429) {
        Logger.warn('[OpenRouter] 429 on stream — falling back to non-streaming with retries')
        const tracker = this.getRateLimitTracker(this.model)
        const backoffDelay = this.calculateBackoffDelay(0, tracker.baseDelay)
        this.updateRateLimitTracker(this.model, true)
        await sleep(backoffDelay)
      } else {
        Logger.warn('[OpenRouter] Stream failed, falling back to non-streaming: %s | status: %s', detail, status)
      }

      // Fallback: call non-streaming and yield the full content at once
      const result = await this.chat(messages, enableReasoning)
      if (result.content) yield result.content
    }
  }

  private async callModel(
    model: string,
    messages: ConversationMessage[],
    enableReasoning: boolean,
    preserveReasoning: boolean = true
  ): Promise<OpenRouterResponse> {
    const body: any = {
      model,
      messages: messages
        // OpenRouter rejects messages with null/empty content
        .filter((m) => m.content !== null && m.content !== undefined && String(m.content).trim() !== '')
        .map((m) => {
          const msg: any = { role: m.role, content: m.content }
          // Kimi supports multi-turn reasoning via reasoning_details
          // Pass them back to continue reasoning from where it left off
          if (m.reasoning_details) {
            msg.reasoning_details = m.reasoning_details
          }
          return msg
        }),
    }

    // Enable reasoning on Kimi model
    if (enableReasoning) {
      body.reasoning = { enabled: true }
    }

    const res = await axios.post(this.baseUrl, body, {
      headers: this.headers,
      timeout: 60000,
    })

    const message = res.data?.choices?.[0]?.message
    if (!message) throw new Error('Empty response from OpenRouter')

    return {
      content: message.content ?? null,
      reasoning_details: message.reasoning_details,
      model: res.data.model ?? model,
      usage: res.data.usage,
    }
  }
}

export default new OpenRouterServiceClass()

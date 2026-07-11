import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { ConversationMessage } from 'App/Models/AiShopConversation'

export interface GeminiResponse {
  content: string | null
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

class GeminiServiceClass {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
  private readonly rateLimitTrackers = new Map<string, RateLimitTracker>()
  private readonly MAX_RETRIES = 3
  private readonly INITIAL_BACKOFF_MS = 1000 // Start with 1s

  private get apiKey(): string {
    return Env.get('GEMINI_API_KEY', '')
  }

  private get model(): string {
    return Env.get('GEMINI_MODEL', 'gemini-2.0-flash')
  }

  /**
   * Non-streaming chat with enhanced rate limit handling.
   * Implements exponential backoff with jitter for 429 rate limit errors.
   */
  public async chat(messages: ConversationMessage[]): Promise<GeminiResponse> {
    return await this.callWithRetry(messages)
  }

  /**
   * Get or initialize rate limit tracker for Gemini
   */
  private getRateLimitTracker(): RateLimitTracker {
    const key = 'gemini'
    if (!this.rateLimitTrackers.has(key)) {
      this.rateLimitTrackers.set(key, {
        lastResetTime: Date.now(),
        requestCount: 0,
        baseDelay: this.INITIAL_BACKOFF_MS,
      })
    }
    return this.rateLimitTrackers.get(key)!
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
  private updateRateLimitTracker(isRateLimit: boolean): void {
    const tracker = this.getRateLimitTracker()
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
      Logger.warn('[Gemini] Rate limit detected. Base delay adjusted to: %dms', tracker.baseDelay)
    }
  }

  /**
   * Wraps callModel with exponential backoff retry logic (up to MAX_RETRIES).
   * Handles 429 rate limits and 5xx server errors with adaptive backoff.
   */
  private async callWithRetry(
    messages: ConversationMessage[],
    retryCount: number = 0
  ): Promise<GeminiResponse> {
    try {
      return await this.callModel(messages)
    } catch (err: any) {
      const status = err.response?.status
      const isRetryable = status === 429 || (status >= 500 && status < 600)

      if (!isRetryable || retryCount >= this.MAX_RETRIES) {
        throw err
      }

      const tracker = this.getRateLimitTracker()
      const backoffDelay = this.calculateBackoffDelay(retryCount, tracker.baseDelay)
      this.updateRateLimitTracker(status === 429)

      const reason = status === 429 ? 'rate limit (429)' : `server error (${status})`
      Logger.warn(
        '[Gemini] %s — retrying in %dms (attempt %d/%d)',
        reason,
        Math.round(backoffDelay),
        retryCount + 1,
        this.MAX_RETRIES
      )

      await sleep(backoffDelay)
      return this.callWithRetry(messages, retryCount + 1)
    }
  }

  /**
   * Streaming chat with improved rate limit handling.
   * Returns an async generator that yields token chunks.
   * Falls back to non-streaming if stream fails.
   *
   * Usage:
   *   for await (const chunk of geminiService.stream(messages)) {
   *     res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`)
   *   }
   */
  public async *stream(messages: ConversationMessage[]): AsyncGenerator<string> {
    const url = `${this.baseUrl}/${this.model}:streamGenerateContent`
    const body = {
      contents: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }

    try {
      const res = await axios.post(url, body, {
        responseType: 'stream',
        timeout: 90000,
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey,
        },
      })

      let buffer = ''

      for await (const rawChunk of res.data) {
        buffer += rawChunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            // Gemini streaming format: each line is a JSON object
            const json = JSON.parse(trimmed)
            const textContent = json?.candidates?.[0]?.content?.parts?.[0]?.text
            if (textContent) yield textContent
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (error: any) {
      const status = error.response?.status
      const detail = error.response?.data?.error?.message ?? error.message

      if (status === 429) {
        Logger.warn('[Gemini] 429 on stream — falling back to non-streaming with retries')
        const tracker = this.getRateLimitTracker()
        const backoffDelay = this.calculateBackoffDelay(0, tracker.baseDelay)
        this.updateRateLimitTracker(true)
        await sleep(backoffDelay)
      } else {
        Logger.warn('[Gemini] Stream failed, falling back to non-streaming: %s | status: %s', detail, status)
      }

      // Fallback: call non-streaming and yield the full content at once
      const result = await this.chat(messages)
      if (result.content) yield result.content
    }
  }

  private async callModel(messages: ConversationMessage[]): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/${this.model}:generateContent`

    const body = {
      contents: messages
        .filter((m) => m.content !== null && m.content !== undefined && String(m.content).trim() !== '')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }

    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
      timeout: 60000,
    })

    const textContent = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textContent) throw new Error('Empty response from Gemini')

    return {
      content: textContent,
      model: this.model,
      usage: {
        prompt_tokens: res.data?.usageMetadata?.promptTokenCount ?? 0,
        completion_tokens: res.data?.usageMetadata?.candidatesTokenCount ?? 0,
      },
    }
  }
}

export default new GeminiServiceClass()

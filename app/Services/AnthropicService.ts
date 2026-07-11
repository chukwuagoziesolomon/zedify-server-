import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { ConversationMessage } from 'App/Models/AiShopConversation'

export interface AnthropicResponse {
  content: string | null
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface RateLimitTracker {
  lastResetTime: number
  requestCount: number
  baseDelay: number
}

class AnthropicServiceClass {
  private readonly baseUrl = 'https://api.anthropic.com/v1/messages'
  private readonly rateLimitTrackers = new Map<string, RateLimitTracker>()
  private readonly MAX_RETRIES = 3
  private readonly INITIAL_BACKOFF_MS = 1000

  private get apiKey(): string {
    return Env.get('ANTHROPIC_API_KEY', '')
  }

  private get model(): string {
    return Env.get('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }

  private getRateLimitTracker(): RateLimitTracker {
    if (!this.rateLimitTrackers.has(this.model)) {
      this.rateLimitTrackers.set(this.model, {
        lastResetTime: Date.now(),
        requestCount: 0,
        baseDelay: this.INITIAL_BACKOFF_MS,
      })
    }
    return this.rateLimitTrackers.get(this.model)!
  }

  private calculateBackoffDelay(retryCount: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount)
    const jitter = Math.random() * (baseDelay * 0.2)
    return exponentialDelay + jitter
  }

  private updateRateLimitTracker(isRateLimit: boolean): void {
    const tracker = this.getRateLimitTracker()
    const now = Date.now()

    if (now - tracker.lastResetTime > 60000) {
      tracker.requestCount = 0
      tracker.lastResetTime = now
      tracker.baseDelay = this.INITIAL_BACKOFF_MS
    }

    tracker.requestCount++

    if (isRateLimit) {
      tracker.baseDelay = Math.min(tracker.baseDelay * 1.5, 10000)
      Logger.warn('[Anthropic] Rate limit detected for %s. Base delay adjusted to: %dms', this.model, tracker.baseDelay)
    }
  }

  public async chat(messages: ConversationMessage[]): Promise<AnthropicResponse> {
    return await this.callWithRetry(messages)
  }

  private async callWithRetry(
    messages: ConversationMessage[],
    retryCount: number = 0
  ): Promise<AnthropicResponse> {
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
        '[Anthropic] %s on %s — retrying in %dms (attempt %d/%d)',
        reason,
        this.model,
        Math.round(backoffDelay),
        retryCount + 1,
        this.MAX_RETRIES
      )

      await sleep(backoffDelay)
      return this.callWithRetry(messages, retryCount + 1)
    }
  }

  public async *stream(messages: ConversationMessage[]): AsyncGenerator<string> {
    const { system, contents } = this.buildPayload(messages)

    const body = {
      model: this.model,
      stream: true,
      max_tokens: 2048,
      system,
      messages: contents,
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
            const token = json?.delta?.text
            if (token) yield token
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (error: any) {
      const status = error.response?.status
      const detail = error.response?.data?.error?.message ?? error.message

      if (status === 429) {
        Logger.warn('[Anthropic] 429 on stream — falling back to non-streaming with retries')
        const tracker = this.getRateLimitTracker()
        const backoffDelay = this.calculateBackoffDelay(0, tracker.baseDelay)
        this.updateRateLimitTracker(true)
        await sleep(backoffDelay)
      } else {
        Logger.warn('[Anthropic] Stream failed, falling back to non-streaming: %s | status: %s', detail, status)
      }

      const result = await this.chat(messages)
      if (result.content) yield result.content
    }
  }

  private async callModel(messages: ConversationMessage[]): Promise<AnthropicResponse> {
    const { system, contents } = this.buildPayload(messages)

    const body = {
      model: this.model,
      max_tokens: 2048,
      system,
      messages: contents,
    }

    const res = await axios.post(this.baseUrl, body, {
      headers: this.headers,
      timeout: 60000,
    })

    const textBlock = res.data?.content?.[0]
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Empty response from Anthropic')
    }

    return {
      content: textBlock.text,
      model: res.data.model ?? this.model,
      usage: {
        prompt_tokens: res.data?.usage?.input_tokens ?? 0,
        completion_tokens: res.data?.usage?.output_tokens ?? 0,
      },
    }
  }

  private buildPayload(messages: ConversationMessage[]): { system: string | undefined; contents: any[] } {
    const contents: any[] = []
    let system: string | undefined

    for (const m of messages) {
      if (m.role === 'system') {
        system = m.content ?? undefined
        continue
      }
      contents.push({
        role: m.role,
        content: [
          {
            type: 'text',
            text: m.content ?? '',
          },
        ],
      })
    }

    return { system, contents }
  }
}

export default new AnthropicServiceClass()

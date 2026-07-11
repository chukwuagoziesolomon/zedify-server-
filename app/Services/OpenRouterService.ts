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

class OpenRouterServiceClass {
  private readonly baseUrl = 'https://openrouter.ai/api/v1/chat/completions'
  private get apiKey(): string {
    return Env.get('OPENROUTER_API_KEY', '')
  }
  private get primaryModel(): string {
    return Env.get('OPENROUTER_PRIMARY_MODEL', 'meta-llama/llama-3.2-3b-instruct:free')
  }
  private get fallbackModel(): string {
    return Env.get('OPENROUTER_FALLBACK_MODEL', 'meta-llama/llama-3.3-70b-instruct:free')
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
   * Non-streaming chat — returns full response after completion.
   * Retries once on 429 (rate limit) with a 3-second delay before falling back.
   */
  public async chat(
    messages: ConversationMessage[],
    enableReasoning: boolean = true
  ): Promise<OpenRouterResponse> {
    try {
      // Primary: pass reasoning_details back for multi-turn continuation
      return await this.callWithRetry(this.primaryModel, messages, enableReasoning, true)
    } catch (primaryError: any) {
      const detail = primaryError.response?.data?.error?.message ?? primaryError.response?.data?.message ?? primaryError.message
      Logger.warn('OpenRouter primary model failed, falling back. Error: %s | status: %s', detail, primaryError.response?.status)
      try {
        // Fallback: strip reasoning_details — free models don't support it
        return await this.callWithRetry(this.fallbackModel, messages, false, false)
      } catch (fallbackError: any) {
        throw new Error(`OpenRouter both models failed. Last error: ${fallbackError.message}`)
      }
    }
  }

  /**
   * Wraps callModel with a single 429-retry (3s delay).
   */
  private async callWithRetry(
    model: string,
    messages: ConversationMessage[],
    enableReasoning: boolean,
    preserveReasoning: boolean
  ): Promise<OpenRouterResponse> {
    try {
      return await this.callModel(model, messages, enableReasoning, preserveReasoning)
    } catch (err: any) {
      if (err.response?.status === 429) {
        Logger.warn('[OpenRouter] 429 rate limit on %s — retrying in 3s', model)
        await sleep(3000)
        return await this.callModel(model, messages, enableReasoning, preserveReasoning)
      }
      throw err
    }
  }

  /**
   * Streaming chat — returns an async generator that yields token chunks one by one.
   * Falls back to non-streaming if the stream fails.
   *
   * Usage:
   *   for await (const chunk of openRouterService.stream(messages)) {
   *     res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`)
   *   }
   */
  public async *stream(
    messages: ConversationMessage[],
    enableReasoning: boolean = false
  ): AsyncGenerator<string> {
    const body = {
      model: this.primaryModel,
      stream: true,
      // Never forward reasoning_details for streaming — causes 400 on most models
      messages: messages
        .filter((m) => m.content !== null && m.content !== undefined && String(m.content).trim() !== '')
        .map((m) => ({ role: m.role, content: m.content })),
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
      const detail = error.response?.data?.error?.message ?? error.response?.data?.message ?? error.message
      Logger.warn('[OpenRouter] Stream failed, falling back to non-streaming: %s | status: %s', detail, error.response?.status)
      if (error.response?.status === 429) {
        Logger.warn('[OpenRouter] 429 on stream — waiting 3s before non-streaming fallback')
        await sleep(3000)
      }
      // Fallback: call non-streaming and yield the full content at once
      const result = await this.chat(messages, false)
      if (result.content) yield result.content
    }
  }

  private async callModel(
    model: string,
    messages: ConversationMessage[],
    enableReasoning: boolean,
    preserveReasoning: boolean = false
  ): Promise<OpenRouterResponse> {
    const body: any = {
      model,
      messages: messages
        // OpenRouter rejects messages with null/empty content
        .filter((m) => m.content !== null && m.content !== undefined && String(m.content).trim() !== '')
        .map((m) => {
          const msg: any = { role: m.role, content: m.content }
          // Pass reasoning_details back to primary model for multi-turn continuation.
          // On the first turn enableReasoning=true triggers reasoning; on subsequent turns
          // the preserved reasoning_details let the model continue from where it left off
          // even without re-enabling reasoning (matches OpenRouter multi-turn pattern).
          if (preserveReasoning && m.reasoning_details) msg.reasoning_details = m.reasoning_details
          return msg
        }),
    }

    // Only set reasoning.enabled on turns where we explicitly want to start reasoning
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

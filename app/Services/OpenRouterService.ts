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

class OpenRouterServiceClass {
  private readonly baseUrl = 'https://openrouter.ai/api/v1/chat/completions'
  private get apiKey(): string {
    return Env.get('OPENROUTER_API_KEY', '')
  }
  private get primaryModel(): string {
    return Env.get('OPENROUTER_PRIMARY_MODEL', 'anthropic/claude-haiku-latest')
  }
  private get fallbackModel(): string {
    return Env.get('OPENROUTER_FALLBACK_MODEL', 'meta-llama/llama-3.3-70b-instruct:free')
  }

  /**
   * Send a chat completion request with multi-turn memory and reasoning support.
   * Automatically falls back to the free model if the primary call fails.
   *
   * @param messages - Full conversation history including preserved reasoning_details
   * @param enableReasoning - Whether to enable chain-of-thought reasoning (primary model only)
   */
  public async chat(
    messages: ConversationMessage[],
    enableReasoning: boolean = true
  ): Promise<OpenRouterResponse> {
    try {
      return await this.callModel(this.primaryModel, messages, enableReasoning)
    } catch (primaryError: any) {
      Logger.warn('OpenRouter primary model failed, falling back. Error: %s', primaryError.message)
      try {
        // Fallback model — reasoning not supported on free tier
        return await this.callModel(this.fallbackModel, messages, false)
      } catch (fallbackError: any) {
        throw new Error(`OpenRouter both models failed. Last error: ${fallbackError.message}`)
      }
    }
  }

  private async callModel(
    model: string,
    messages: ConversationMessage[],
    enableReasoning: boolean
  ): Promise<OpenRouterResponse> {
    const body: any = {
      model,
      messages: messages.map((m) => {
        const msg: any = { role: m.role, content: m.content }
        // Preserve reasoning_details for multi-turn continuity (Claude only)
        if (m.reasoning_details) {
          msg.reasoning_details = m.reasoning_details
        }
        return msg
      }),
    }

    if (enableReasoning) {
      body.reasoning = { enabled: true }
    }

    const res = await axios.post(this.baseUrl, body, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://wt-payments.com',
        'X-Title': 'WT Payments AI Shop Builder',
      },
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

import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Shop from 'App/Models/Shop'
import ShopProduct from 'App/Models/ShopProduct'
import AiShopConversation, {
  ConversationMessage,
  EntityMemory,
} from 'App/Models/AiShopConversation'
import OpenRouterService from './OpenRouterService'
import { genRandomUuid } from 'App/helpers/utils'

// ─── Memory constants ──────────────────────────────────────────────────────────
/**
 * Buffer Memory: how many raw messages to keep in the short-term context window.
 * Messages older than this get compressed into Summary Memory.
 */
const BUFFER_SIZE = 10

/**
 * AiShopBuilderService — 3-Tier Memory Architecture
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Tier 1 – Buffer Memory  (short-term)                                    │
 * │    Last BUFFER_SIZE raw messages. Sent verbatim to the model each turn.  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  Tier 2 – Summary Memory  (medium-term)                                  │
 * │    AI-generated compressed summary of messages older than the buffer.    │
 * │    Injected into the system prompt so old context is never fully lost.   │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  Tier 3 – Entity Memory  (long-term)                                     │
 * │    Structured key-value facts extracted by the AI (colors, style,        │
 * │    product categories, merchant preferences). Always in context.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Streaming:
 *   - `chat()` — standard non-streaming (for API clients that can wait)
 *   - `chatStream()` — async generator that yields token chunks for SSE
 */
class AiShopBuilderServiceClass {
  private get baseDomain(): string {
    return Env.get('SHOP_BASE_DOMAIN', 'yourdomain.com')
  }

  // ─── System Prompt Builder ────────────────────────────────────────────────

  private async buildSystemPrompt(
    shop: Shop,
    summaryMemory: string | null,
    entityMemory: EntityMemory | null
  ): Promise<string> {
    const products = await ShopProduct.query()
      .where('shopId', shop.uniqueId)
      .where('isActive', true)
      .orderBy('createdAt', 'desc')

    const productSummary =
      products.length === 0
        ? 'No products added yet.'
        : products
            .map(
              (p, i) =>
                `${i + 1}. "${p.name}" — ${p.currency} ${p.price}${p.category ? ` (${p.category})` : ''}${p.description ? ` — ${p.description}` : ''}`
            )
            .join('\n')

    const themeStr = shop.themeConfig
      ? JSON.stringify(shop.themeConfig, null, 2)
      : 'Not customized yet.'

    // ── Tier 3: Entity Memory block ──
    let entityBlock = ''
    if (entityMemory && Object.keys(entityMemory).length > 0) {
      entityBlock = `
## Remembered Facts About This Shop (Entity Memory)
${Object.entries(entityMemory)
  .filter(([, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true))
  .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`)
  .join('\n')}
`
    }

    // ── Tier 2: Summary Memory block ──
    let summaryBlock = ''
    if (summaryMemory) {
      summaryBlock = `
## Summary of Earlier Conversation
${summaryMemory}
`
    }

    return `You are an expert AI e-commerce shop builder assistant for the WT Payments platform.
You are helping the merchant build and customize their online shop.
${entityBlock}${summaryBlock}
## Current Shop State
- Business Name: ${shop.businessName}
- Shop URL: https://${shop.subdomain}.${this.baseDomain}
- Status: ${shop.status}
- Currency: ${shop.currency}
- Description: ${shop.description || 'Not set yet.'}

## Current Theme Configuration
${themeStr}

## Current Products (${products.length})
${productSummary}

## Your Instructions
- Help the merchant design their shop (colors, layout, style, pages, hero sections)
- Suggest product descriptions, categories, and pricing strategies
- Guide them on accepting payments via WT Payments (crypto + fiat)
- When asked to update the theme or shop appearance, respond with a JSON block wrapped in \`\`\`json\`\`\` using this schema:
  { "action": "update_theme", "theme_config": { "primaryColor": "#...", "accentColor": "#...", "fontFamily": "...", "layout": "grid|list", "heroText": "...", "heroSubtext": "..." } }
- When the merchant mentions specific preferences (colors, style words, product categories), REMEMBER them — they are in your entity memory.
- Respond naturally for descriptions, advice, and suggestions.
- Always be concise, friendly, and business-focused.
- Do NOT suggest Stripe, PayPal, or any gateway other than WT Payments.`
  }

  // ─── Memory Compression ───────────────────────────────────────────────────

  /**
   * Compress messages older than the buffer window into a summary, and extract entities.
   * Called whenever the buffer overflows.
   */
  private async compressMemory(
    conversation: AiShopConversation,
    allMessages: ConversationMessage[]
  ): Promise<void> {
    const toSummarize = allMessages.slice(0, allMessages.length - BUFFER_SIZE)
    if (toSummarize.length === 0) return

    const contextForSummarizer: ConversationMessage[] = [
      {
        role: 'system',
        content: `You are a memory compression assistant for an AI shop builder chatbot.
Given a conversation excerpt, produce TWO outputs separated by ---ENTITIES---:

1. A concise paragraph summary (max 200 words) of what was discussed so far. Focus on decisions made, design choices, and product information.
2. A JSON object of extracted entities in this format:
{"businessName":"...","primaryColor":"#...","accentColor":"#...","fontFamily":"...","layout":"...","heroText":"...","currency":"...","targetAudience":"...","styleKeywords":["..."],"productCategories":["..."],"preferences":{}}

Only include fields that were explicitly mentioned. Output format:
<summary text here>
---ENTITIES---
<json here>`,
      },
      ...toSummarize,
      {
        role: 'user',
        content:
          'Please compress the conversation above into a summary and extracted entities as instructed.',
      },
    ]

    try {
      const compressionResponse = await OpenRouterService.chat(contextForSummarizer, false)
      const raw = compressionResponse.content ?? ''
      const parts = raw.split('---ENTITIES---')

      const newSummary = parts[0].trim()
      // Merge with any existing summary
      if (newSummary) {
        const existingSummary = conversation.summaryMemory ?? ''
        conversation.summaryMemory = existingSummary
          ? `${existingSummary}\n\n${newSummary}`
          : newSummary
      }

      // Extract and merge entities
      if (parts[1]) {
        try {
          const jsonMatch = parts[1].match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const newEntities: EntityMemory = JSON.parse(jsonMatch[0])
            const existing: EntityMemory = conversation.entityMemory ?? {}
            // Merge: new values override old, arrays are union-merged
            const merged: EntityMemory = { ...existing, ...newEntities }
            if (newEntities.styleKeywords || existing.styleKeywords) {
              merged.styleKeywords = Array.from(
                new Set([...(existing.styleKeywords ?? []), ...(newEntities.styleKeywords ?? [])])
              )
            }
            if (newEntities.productCategories || existing.productCategories) {
              merged.productCategories = Array.from(
                new Set([
                  ...(existing.productCategories ?? []),
                  ...(newEntities.productCategories ?? []),
                ])
              )
            }
            conversation.entityMemory = merged
          }
        } catch (parseErr) {
          Logger.warn('[AiShopBuilder] Failed to parse entity memory JSON: %s', parseErr)
        }
      }
    } catch (err) {
      Logger.warn('[AiShopBuilder] Memory compression failed (non-fatal): %s', err)
    }
  }

  // ─── Conversation Setup ───────────────────────────────────────────────────

  private async getOrCreateConversation(shopId: string): Promise<AiShopConversation> {
    let conversation = await AiShopConversation.query().where('shopId', shopId).first()
    if (!conversation) {
      conversation = await AiShopConversation.create({
        uniqueId: genRandomUuid(),
        shopId,
        messages: [],
        summaryMemory: null,
        entityMemory: null,
        lastAction: null,
      })
    }
    return conversation
  }

  /**
   * Build the message list to send to the API using the 3-tier memory system.
   *
   * Layout:
   *   [system prompt (with entity + summary blocks)]
   *   [Tier 1: last BUFFER_SIZE raw messages from buffer]
   *   [new user message]
   */
  private async buildApiMessages(
    shop: Shop,
    conversation: AiShopConversation,
    userMessage: string
  ): Promise<ConversationMessage[]> {
    const systemPrompt = await this.buildSystemPrompt(
      shop,
      conversation.summaryMemory,
      conversation.entityMemory
    )

    // Buffer = last BUFFER_SIZE messages
    const rawMsgs = Array.isArray(conversation.messages) ? conversation.messages : []
    const buffer = rawMsgs.slice(-BUFFER_SIZE)

    const newUserMessage: ConversationMessage = { role: 'user', content: userMessage }

    return [{ role: 'system', content: systemPrompt }, ...buffer, newUserMessage]
  }

  /**
   * Persist user + assistant messages, run memory compression if needed.
   */
  private async persistAndCompress(
    conversation: AiShopConversation,
    userMessage: string,
    assistantContent: string,
    reasoningDetails?: any[]
  ): Promise<void> {
    const newUserMsg: ConversationMessage = { role: 'user', content: userMessage }
    const newAssistantMsg: ConversationMessage = {
      role: 'assistant',
      content: assistantContent,
      ...(reasoningDetails ? { reasoning_details: reasoningDetails } : {}),
    }

    const existing = Array.isArray(conversation.messages) ? conversation.messages : []
    const allMessages = [...existing, newUserMsg, newAssistantMsg]

    // Compress if buffer overflows
    if (allMessages.length > BUFFER_SIZE) {
      await this.compressMemory(conversation, allMessages)
      // Keep only the last BUFFER_SIZE messages in the buffer
      conversation.messages = allMessages.slice(-BUFFER_SIZE)
    } else {
      conversation.messages = allMessages
    }

    conversation.lastAction = userMessage.slice(0, 100)
    await conversation.save()
  }

  // ─── Action Handling ──────────────────────────────────────────────────────

  private parseAction(content: string | null): any | null {
    if (!content) return null
    const match = content.match(/```json\s*([\s\S]*?)```/)
    if (!match) return null
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }

  private async applyAction(shop: Shop, action: any): Promise<void> {
    if (action?.action === 'update_theme' && action.theme_config) {
      shop.themeConfig = { ...(shop.themeConfig || {}), ...action.theme_config }
      await shop.save()
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Non-streaming chat — waits for the full AI response and returns it.
   * Maintains 3-tier memory automatically.
   */
  public async chat(
    shopId: string,
    userMessage: string
  ): Promise<{ reply: string; action: any | null; conversationId: string }> {
    const shop = await Shop.query().where('uniqueId', shopId).firstOrFail()
    const conversation = await this.getOrCreateConversation(shopId)

    const apiMessages = await this.buildApiMessages(shop, conversation, userMessage)
    // enableReasoning: false — free models don't support it; switch to true when using Claude
    const aiResponse = await OpenRouterService.chat(apiMessages, false)

    await this.persistAndCompress(
      conversation,
      userMessage,
      aiResponse.content ?? '',
      aiResponse.reasoning_details
    )

    const action = this.parseAction(aiResponse.content)
    await this.applyAction(shop, action)

    return {
      reply: aiResponse.content ?? '',
      action,
      conversationId: conversation.uniqueId,
    }
  }

  /**
   * Streaming chat — yields token chunks as the AI generates them.
   * Saves the fully assembled response to memory when complete.
   *
   * Usage in a controller (SSE endpoint):
   *   for await (const event of AiShopBuilderService.chatStream(shopId, message)) {
   *     res.write(`data: ${JSON.stringify(event)}\n\n`)
   *   }
   *
   * Events emitted:
   *   { type: 'token', content: '...' }          — each token chunk
   *   { type: 'action', action: { ... } }         — if AI returned a JSON action
   *   { type: 'done', conversation_id: '...' }    — stream complete
   *   { type: 'error', message: '...' }           — on failure
   */
  public async *chatStream(
    shopId: string,
    userMessage: string
  ): AsyncGenerator<{ type: string; [key: string]: any }> {
    let shop: Shop
    let conversation: AiShopConversation

    try {
      shop = await Shop.query().where('uniqueId', shopId).firstOrFail()
      conversation = await this.getOrCreateConversation(shopId)
    } catch (err: any) {
      yield { type: 'error', message: 'Shop not found.' }
      return
    }

    let apiMessages: ConversationMessage[]
    try {
      apiMessages = await this.buildApiMessages(shop, conversation, userMessage)
    } catch (err: any) {
      yield { type: 'error', message: 'Failed to build conversation context.' }
      return
    }

    let assembled = ''

    try {
      for await (const token of OpenRouterService.stream(apiMessages, false)) {
        assembled += token
        yield { type: 'token', content: token }
      }
    } catch (err: any) {
      Logger.error('[AiShopBuilder] Streaming error: %s', err.message)
      yield { type: 'error', message: 'AI stream interrupted.' }
      // Still try to persist what we assembled so far
      if (assembled) {
        await this.persistAndCompress(conversation, userMessage, assembled).catch(() => {})
      }
      return
    }

    // Persist the complete response
    try {
      await this.persistAndCompress(conversation, userMessage, assembled)
    } catch (err: any) {
      Logger.warn('[AiShopBuilder] Failed to persist stream response: %s', err.message)
    }

    // Detect and apply any action in the assembled response
    const action = this.parseAction(assembled)
    if (action) {
      try {
        await this.applyAction(shop, action)
      } catch (err: any) {
        Logger.warn('[AiShopBuilder] Failed to apply action: %s', err.message)
      }
      yield { type: 'action', action }
    }

    yield { type: 'done', conversation_id: conversation.uniqueId }
  }

  /**
   * Reset all memory tiers for a shop (start fresh conversation).
   */
  public async resetMemory(shopId: string): Promise<void> {
    const conversation = await AiShopConversation.query().where('shopId', shopId).first()
    if (conversation) {
      conversation.messages = []
      conversation.summaryMemory = null
      conversation.entityMemory = null
      conversation.lastAction = null
      await conversation.save()
    }
  }

  /**
   * Get buffer + memory metadata for a shop.
   */
  public async getHistory(shopId: string): Promise<{
    messages: ConversationMessage[]
    summaryMemory: string | null
    entityMemory: EntityMemory | null
  }> {
    const conversation = await AiShopConversation.query().where('shopId', shopId).first()
    const rawMessages = conversation?.messages
    return {
      messages: Array.isArray(rawMessages) ? rawMessages : [],
      summaryMemory: conversation?.summaryMemory ?? null,
      entityMemory: conversation?.entityMemory ?? null,
    }
  }
}

export default new AiShopBuilderServiceClass()

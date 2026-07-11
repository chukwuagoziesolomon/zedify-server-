import Env from '@ioc:Adonis/Core/Env'
import Shop from 'App/Models/Shop'
import ShopProduct from 'App/Models/ShopProduct'
import AiShopConversation, { ConversationMessage } from 'App/Models/AiShopConversation'
import OpenRouterService from './OpenRouterService'
import { genRandomUuid } from 'App/helpers/utils'

/**
 * AiShopBuilderService
 *
 * AI agent with persistent per-shop memory.
 * Each shop has one conversation thread stored in the DB.
 * Every user message is appended, the AI response (with reasoning_details) is preserved,
 * and the full history is replayed on the next call so the agent remembers context.
 */
class AiShopBuilderServiceClass {
  private get baseDomain(): string {
    return Env.get('SHOP_BASE_DOMAIN', 'yourdomain.com')
  }

  /**
   * Build the system prompt — injects current shop state + products so the AI
   * always has full context without the user repeating themselves.
   */
  private async buildSystemPrompt(shop: Shop): Promise<string> {
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

    return `You are an expert AI e-commerce shop builder assistant for the WT Payments platform.
You are helping the merchant build and customize their online shop.

## Shop Details
- Business Name: ${shop.businessName}
- Shop URL: https://${shop.subdomain}.${this.baseDomain}
- Status: ${shop.status}
- Currency: ${shop.currency}
- Description: ${shop.description || 'Not set yet.'}

## Current Theme
${themeStr}

## Current Products (${products.length})
${productSummary}

## Your Role
- Help the merchant design their shop (colors, layout, style, pages)
- Suggest product descriptions, categories, and pricing strategies
- Guide them on how to accept payments via WT Payments (crypto + fiat)
- When asked to update the theme or shop config, respond with a JSON block wrapped in \`\`\`json\`\`\` that follows this schema:
  { "action": "update_theme", "theme_config": { "primaryColor": "#...", "fontFamily": "...", "layout": "grid|list", "heroText": "...", "heroSubtext": "..." } }
- When asked to write a product description, respond naturally with the text.
- Always be concise, friendly, and business-focused.
- All payments on this platform use WT Payments — no Stripe, PayPal, or other gateways.`
  }

  /**
   * Get or create the conversation thread for a shop.
   */
  private async getOrCreateConversation(shopId: string): Promise<AiShopConversation> {
    let conversation = await AiShopConversation.query().where('shopId', shopId).first()
    if (!conversation) {
      conversation = await AiShopConversation.create({
        uniqueId: genRandomUuid(),
        shopId,
        messages: [],
        lastAction: null,
      })
    }
    return conversation
  }

  /**
   * Send a message to the AI agent and get a response.
   * Memory is automatically maintained — the full history is passed to the model.
   *
   * @param shopId - The shop's uniqueId
   * @param userMessage - The merchant's message
   * @returns AI response text + any parsed action
   */
  public async chat(
    shopId: string,
    userMessage: string
  ): Promise<{ reply: string; action: any | null; conversationId: string }> {
    const shop = await Shop.query().where('uniqueId', shopId).firstOrFail()
    const conversation = await this.getOrCreateConversation(shopId)

    const systemPrompt = await this.buildSystemPrompt(shop)

    // Build the full message array: system + history + new user message
    const systemMessage: ConversationMessage = { role: 'system', content: systemPrompt }
    const newUserMessage: ConversationMessage = { role: 'user', content: userMessage }

    const messagesForApi: ConversationMessage[] = [
      systemMessage,
      ...conversation.messages,
      newUserMessage,
    ]

    const aiResponse = await OpenRouterService.chat(messagesForApi, true)

    // Save user message + assistant response (with reasoning_details) to memory
    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: aiResponse.content,
      reasoning_details: aiResponse.reasoning_details,
    }

    const updatedMessages = [...conversation.messages, newUserMessage, assistantMessage]
    conversation.messages = updatedMessages
    conversation.lastAction = userMessage.slice(0, 100)
    await conversation.save()

    // Parse any action JSON the AI returned (e.g. update_theme)
    const action = this.parseAction(aiResponse.content)

    // Auto-apply theme updates if AI returned one
    if (action?.action === 'update_theme' && action.theme_config) {
      shop.themeConfig = { ...(shop.themeConfig || {}), ...action.theme_config }
      await shop.save()
    }

    return {
      reply: aiResponse.content ?? '',
      action,
      conversationId: conversation.uniqueId,
    }
  }

  /**
   * Extract a JSON action block from the AI response if present.
   */
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

  /**
   * Clear the conversation memory for a shop (start fresh).
   */
  public async resetMemory(shopId: string): Promise<void> {
    const conversation = await AiShopConversation.query().where('shopId', shopId).first()
    if (conversation) {
      conversation.messages = []
      conversation.lastAction = null
      await conversation.save()
    }
  }

  /**
   * Get full conversation history for a shop.
   */
  public async getHistory(shopId: string): Promise<ConversationMessage[]> {
    const conversation = await AiShopConversation.query().where('shopId', shopId).first()
    return conversation?.messages ?? []
  }
}

export default new AiShopBuilderServiceClass()

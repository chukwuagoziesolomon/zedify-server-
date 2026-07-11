import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | null
}

/**
 * Entity memory — key facts extracted from the conversation.
 * Persisted so the agent never forgets important shop details.
 */
export interface EntityMemory {
  businessName?: string
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
  layout?: string
  heroText?: string
  currency?: string
  targetAudience?: string
  styleKeywords?: string[]        // e.g. ["modern", "minimalist", "bold"]
  productCategories?: string[]    // categories the merchant has mentioned
  preferences?: Record<string, string> // any other key=value facts
}

export default class AiShopConversation extends BaseModel {
  public static table = 'ai_shop_conversations'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public shopId: string // FK → Shop.uniqueId

  /**
   * Buffer memory — raw last N messages (short-term context window).
   * Sent directly to the model on every request.
   */
  @column()
  public messages: ConversationMessage[] = []

  /**
   * Summary memory — AI-compressed summary of messages older than the buffer.
   * Injected into the system prompt so old context is never fully lost.
   */
  @column()
  public summaryMemory: string | null

  /**
   * Entity memory — extracted key facts about the shop and merchant preferences.
   * Updated after every turn by the AI itself.
   */
  @column()
  public entityMemory: EntityMemory | null

  @column()
  public lastAction: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

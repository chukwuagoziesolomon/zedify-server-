import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | null
  reasoning_details?: any[] // preserved from OpenRouter for multi-turn reasoning
}

export default class AiShopConversation extends BaseModel {
  public static table = 'ai_shop_conversations'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public shopId: string // FK → Shop.uniqueId

  @column()
  public messages: ConversationMessage[] = []

  @column()
  public lastAction: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

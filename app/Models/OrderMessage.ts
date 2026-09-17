import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import PaymentIntent from './PaymentIntent'
import User from './User'

export default class OrderMessage extends BaseModel {
  public static table = 'order_messages'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public paymentIntentId: string

  @column()
  public senderId: string

  @column()
  public senderType: 'customer' | 'merchant' | 'system'

  @column()
  public message: string

  @column()
  public isRead: boolean = false

  @column.dateTime()
  public readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => PaymentIntent, { foreignKey: 'paymentIntentId', localKey: 'uniqueId' })
  public paymentIntent: BelongsTo<typeof PaymentIntent>

  @belongsTo(() => User, { foreignKey: 'senderId', localKey: 'uniqueId' })
  public sender: BelongsTo<typeof User>
}

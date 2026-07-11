import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export enum ChannelState {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

export default class PaymentChannel extends BaseModel {
  public static table = 'payment_channels'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string

  @column()
  public channelId: string

  @column()
  public peerId: string

  @column()
  public localBalance: string = '0x0'

  @column()
  public remoteBalance: string = '0x0'

  @column()
  public currency: string = 'Fibt'

  @column()
  public state: ChannelState = ChannelState.PENDING

  @column()
  public isPublic: boolean = true

  @column()
  public isOneWay: boolean = false

  @column()
  public channelOutpoint?: string

  @column()
  public fundingTxHash?: string

  @column.dateTime()
  public fundedAt?: DateTime

  @column.dateTime()
  public closedAt?: DateTime

  @column()
  public metadata?: Record<string, any>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import PaymentIntent from './PaymentIntent'

export enum FiberInvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export default class FiberInvoice extends BaseModel {
  public static table = 'fiber_invoices'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public paymentIntentId: string

  @column()
  public businessId: string

  @column()
  public invoiceAddress: string

  @column()
  public paymentHash?: string

  @column()
  public amountCkb: number

  @column()
  public amountSudt?: number

  @column()
  public sudtTypeScript?: string

  @column()
  public description?: string

  @column()
  public currency: string = 'Fibt'

  @column()
  public status: FiberInvoiceStatus = FiberInvoiceStatus.PENDING

  @column()
  public rawInvoice?: any

  @column.dateTime()
  public expiresAt?: DateTime

  @column.dateTime()
  public paidAt?: DateTime

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => PaymentIntent, { foreignKey: 'paymentIntentId', localKey: 'uniqueId' })
  public paymentIntent: BelongsTo<typeof PaymentIntent>
}

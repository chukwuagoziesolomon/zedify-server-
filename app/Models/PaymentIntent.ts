import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import { PaymentIntentStatus } from 'App/Lib/types'

export default class PaymentIntent extends BaseModel {
  public static table = 'payment_intent_tb'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public businessId: string

  @column()
  public businessReferenceId: string

  @column()
  public fiatCurrencyId: string

  @column()
  public fiatAmount: number

  @column()
  public status: PaymentIntentStatus

  @column()
  public cryptoCurrencyId: string | null

  @column()
  public feeInCrypto: number | null

  @column()
  public walletId: string | null

  @column()
  public customerId: string | null

  @column()
  public customerEmail: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime()
  public receivedPaymentAt?: DateTime

  @column.dateTime()
  public completedAt?: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

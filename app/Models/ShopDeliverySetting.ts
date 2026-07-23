import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Shop from './Shop'

export default class ShopDeliverySetting extends BaseModel {
  public static table = 'shop_delivery_settings'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public shopId: string

  @column()
  public hasFreeDelivery: boolean = false

  @column()
  public deliveryFee: number = 0

  @column()
  public deliveryZones: Record<string, number> | null = null

  @column()
  public discountPercentage: number = 0

  @column()
  public discountAmount: number = 0

  @column()
  public promoCode: string | null = null

  @column()
  public freeDeliveryThreshold: string | null = null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Shop, { foreignKey: 'shopId', localKey: 'uniqueId' })
  public shop: BelongsTo<typeof Shop>
}

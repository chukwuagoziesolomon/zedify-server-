import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class ShopProduct extends BaseModel {
  public static table = 'shop_products'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public shopId: string // FK → Shop.uniqueId

  @column()
  public name: string

  @column()
  public description: string | null

  @column()
  public price: number

  @column()
  public currency: string = 'NGN'

  @column()
  public images: { url: string; publicId: string }[] | null

  @column()
  public category: string | null

  @column()
  public stock: number = 0

  @column()
  public trackStock: boolean = false

  @column()
  public isActive: boolean = true

  @column()
  public variants: any | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

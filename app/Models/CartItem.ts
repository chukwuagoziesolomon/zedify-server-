import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Cart from './Cart'
import ShopProduct from './ShopProduct'

export default class CartItem extends BaseModel {
  public static table = 'cart_items'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public cartId: string

  @column()
  public productId: string

  @column()
  public quantity: number = 1

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Cart, { foreignKey: 'cartId', localKey: 'uniqueId' })
  public cart: BelongsTo<typeof Cart>

  @belongsTo(() => ShopProduct, { foreignKey: 'productId', localKey: 'uniqueId' })
  public product: BelongsTo<typeof ShopProduct>
}

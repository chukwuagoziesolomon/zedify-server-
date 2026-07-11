import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import { ShopFeatures } from 'App/Lib/shopFeatures'
import ShopProduct from './ShopProduct'
import AiShopConversation from './AiShopConversation'

export default class Shop extends BaseModel {
  public static table = 'shops'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public userId: string // FK → User.uniqueId

  @column()
  public businessName: string

  @column()
  public subdomain: string

  @column()
  public description: string | null

  @column()
  public logoUrl: string | null

  @column()
  public logoPublicId: string | null

  @column()
  public bannerUrl: string | null

  @column()
  public bannerPublicId: string | null

  @column()
  public themeConfig: any | null

  @column()
  public pagesConfig: any | null

  @column()
  public status: 'draft' | 'published' = 'draft'

  @column()
  public currency: string = 'NGN'

  @column()
  public shopType: 'default' | 'ai_custom' = 'default'

  @column()
  public template: string | null = null

  @column()
  public customizationAccessPaid: boolean = false

  @column.dateTime()
  public customizationAccessPaidAt: DateTime | null

  @column()
  public customizationPaymentReferenceId: string | null

  @column()
  public features: ShopFeatures | null

  @hasMany(() => ShopProduct, { foreignKey: 'shopId', localKey: 'uniqueId' })
  public products: HasMany<typeof ShopProduct>

  @hasMany(() => AiShopConversation, { foreignKey: 'shopId', localKey: 'uniqueId' })
  public conversations: HasMany<typeof AiShopConversation>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}

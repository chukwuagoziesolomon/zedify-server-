import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import { BaseModel, column, beforeCreate, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import User from './User'
import Product from './Product'

export default class Shop extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public ownerId: number

  @column()
  public name: string

  @column()
  public slug: string

  @column()
  public primaryCategory: string // 'food' | 'fashion' | 'gadgets' | 'vehicles' | ...

  @column()
  public template: string

  @column()
  public logoUrl: string | null

  @column()
  public colorPrimary: string

  @column()
  public colorAccent: string

  @column()
  public colorHighlight: string

  // owner's own call — platform does not force this either way
  @column()
  public allowPayOnDelivery: boolean

  @column({
    prepare: (value: number[]) => JSON.stringify(value),
    consume: (value: string) => (value ? JSON.parse(value) : []),
  })
  public acceptedCurrencyIds: number[]

  @column()
  public isCustomAiTheme: boolean

  @column()
  public status: 'active' | 'suspended' | 'draft'

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  public owner: BelongsTo<typeof User>

  @hasMany(() => Product)
  public products: HasMany<typeof Product>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeCreate()
  public static assignUuid(shop: Shop) {
    shop.uniqueId = uuidv4()
  }
}

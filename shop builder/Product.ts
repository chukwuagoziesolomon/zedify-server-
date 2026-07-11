import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import { BaseModel, column, beforeCreate, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import Shop from './Shop'

/**
 * Shape of `attributes` per category — matches exactly what the Yanga storefront
 * template (ProductCard / ProductModal) reads to render category-specific meta.
 * Not enforced at the DB level (json column) but this is the contract the
 * frontend and ShopBuilderService both rely on.
 */
export interface FoodAttributes {
  unit: string           // e.g. "per plate", "1kg pack"
  readyInMinutes?: number
}
export interface FashionAttributes {
  sizes: string[]        // e.g. ["S","M","L","XL"]
  colors?: string[]
}
export interface GadgetAttributes {
  specs: string[]        // e.g. ["8GB RAM","128GB","5000mAh"]
  warrantyMonths?: number
}
export interface VehicleAttributes {
  year: number
  mileageKm: number
  transmission: 'automatic' | 'manual'
}

export default class Product extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public shopId: number

  @column()
  public category: string

  @column()
  public name: string

  @column()
  public description: string | null

  @column()
  public priceNaira: number

  @column()
  public imageUrl: string | null

  @column({
    prepare: (value: object) => JSON.stringify(value ?? {}),
    consume: (value: string) => (value ? JSON.parse(value) : {}),
  })
  public attributes: FoodAttributes | FashionAttributes | GadgetAttributes | VehicleAttributes | Record<string, unknown>

  @column()
  public stockQuantity: number | null

  @column()
  public status: 'active' | 'out_of_stock' | 'archived'

  @belongsTo(() => Shop)
  public shop: BelongsTo<typeof Shop>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeCreate()
  public static assignUuid(product: Product) {
    product.uniqueId = uuidv4()
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shop_delivery_settings'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('shop_id').notNullable().references('unique_id').inTable('shops').onDelete('CASCADE')
      table.boolean('has_free_delivery').notNullable().defaultTo(false)
      table.decimal('delivery_fee', 10, 2).notNullable().defaultTo(0)
      table.json('delivery_zones').nullable().comment('JSON map of state/location to delivery fee, e.g. {"Lagos": 500, "Abuja": 1000}')
      table.decimal('discount_percentage', 5, 2).notNullable().defaultTo(0).comment('Percentage discount applied at checkout, e.g. 10 for 10% off')
      table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0).comment('Fixed amount discount applied at checkout')
      table.string('promo_code').nullable().comment('Optional promo code customers can use')
      table.string('free_delivery_threshold').nullable().comment('Minimum order amount for free delivery')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

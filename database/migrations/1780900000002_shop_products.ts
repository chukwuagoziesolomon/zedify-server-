import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shop_products'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('shop_id').notNullable().references('unique_id').inTable('shops').onDelete('CASCADE')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.decimal('price', 15, 2).notNullable().defaultTo(0)
      table.string('currency').notNullable().defaultTo('NGN')
      table.json('images').nullable()                  // array of { url, public_id }
      table.string('category').nullable()
      table.integer('stock').notNullable().defaultTo(0)
      table.boolean('track_stock').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.json('variants').nullable()                // e.g. sizes, colors
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.uuid('unique_id').notNullable().unique()
      table.integer('shop_id').unsigned().notNullable().references('id').inTable('shops').onDelete('CASCADE')

      table.string('category').notNullable() // 'food' | 'fashion' | 'gadgets' | 'vehicles' | ...
      table.string('name').notNullable()
      table.text('description').nullable()
      table.decimal('price_naira', 18, 2).notNullable()
      table.string('image_url').nullable()

      // category-specific fields live here rather than as sparse nullable columns —
      // e.g. food: {unit, readyInMinutes} · fashion: {sizes, colors} · gadgets: {specs, warrantyMonths}
      // vehicles: {year, mileageKm, transmission}
      table.json('attributes').notNullable().defaultTo('{}')

      table.integer('stock_quantity').nullable() // null = unlimited/made-to-order
      table.string('status').notNullable().defaultTo('active') // active | out_of_stock | archived

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      table.index(['shop_id'])
      table.index(['category'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

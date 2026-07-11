import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payment_links'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('business_id').notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('slug', 64).notNullable().unique()
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.string('fiat_currency_id').nullable().references('unique_id').inTable('currencies')
      table.decimal('fiat_amount', 20, 8).nullable()
      table.string('status', 32).notNullable().defaultTo('active')
      table.boolean('is_single_use').notNullable().defaultTo(false)
      table.integer('usage_count').notNullable().defaultTo(0)
      table.integer('usage_limit').nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

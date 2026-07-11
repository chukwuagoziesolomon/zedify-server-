import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'fiat_deposits'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()

      // FK → users.id (integer PK)
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      // FK → currencies.id (integer PK)
      table.integer('target_currency_id').unsigned().notNullable().references('id').inTable('currencies')

      table.decimal('naira_amount', 18, 2).notNullable()
      table.decimal('exchange_rate', 24, 8).nullable()    // NGN per 1 stablecoin unit, locked at conversion time
      table.decimal('converted_amount', 24, 8).nullable() // stablecoin units actually credited

      table.string('provider').notNullable()              // 'paystack' | 'flutterwave'
      table.string('provider_reference').notNullable().unique()

      // pending → fiat_received → converting → credited  (or → failed at any stage)
      table.string('status').notNullable().defaultTo('pending')
      table.text('failure_reason').nullable()

      // Optional: shop that unlocks AI customisation once this deposit is credited
      table.string('shop_customization_id').nullable()

      table.timestamp('fiat_received_at', { useTz: true }).nullable()
      table.timestamp('credited_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      table.index(['status'])
      table.index(['user_id'])
      table.index(['shop_customization_id'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

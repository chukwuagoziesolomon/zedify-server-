import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payment_intent_tb'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('business_id').notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('business_reference_id', 255).notNullable()
      table.string('fiat_currency_id').notNullable().references('unique_id').inTable('currencies')
      table.decimal('fiat_amount', 20, 8).notNullable()
      table.string('status').notNullable().defaultTo('payment_created')
      table.string('crypto_currency_id').nullable().references('unique_id').inTable('currencies')
      table.decimal('fee_in_crypto', 20, 8).nullable()
      table.string('wallet_id').nullable().references('unique_id').inTable('wallets')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('received_payment_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

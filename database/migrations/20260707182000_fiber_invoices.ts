import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'fiber_invoices'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('payment_intent_id', 255).notNullable()
      table.string('business_id', 255).notNullable()
      table.string('invoice_address', 255).notNullable()
      table.string('payment_hash').nullable()
      table.decimal('amount_ckb', 20, 8).notNullable()
      table.string('description').nullable()
      table.string('currency', 50).defaultTo('Fibt')
      table.string('status', 50).defaultTo('pending')
      table.json('raw_invoice').nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('paid_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

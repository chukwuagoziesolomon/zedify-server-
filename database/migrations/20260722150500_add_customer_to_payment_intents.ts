import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payment_intent_tb'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('customer_id').nullable().references('unique_id').inTable('users').onDelete('SET NULL')
      table.string('customer_email').nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('customer_id')
      table.dropColumn('customer_email')
    })
  }
}

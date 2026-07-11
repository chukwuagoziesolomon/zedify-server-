import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payout_details'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('user_id').unsigned().notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('network_id').nullable()
      table.string('wallet_address').nullable()
      table.string('currency_id').nullable()
      table.string('bank_account_no').nullable()
      table.string('bank_name').nullable()
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

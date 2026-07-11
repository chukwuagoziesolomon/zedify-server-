import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_currency_tb'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('currency_id').unsigned().notNullable().references('unique_id').inTable('currencies').onDelete('CASCADE')
      table.string('user_id').unsigned().notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('status').notNullable().defaultTo('active')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.unique(['currency_id', 'user_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

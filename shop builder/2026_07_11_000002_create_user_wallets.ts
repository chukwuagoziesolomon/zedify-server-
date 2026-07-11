import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'user_wallets'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.uuid('unique_id').notNullable().unique()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('currency_id').unsigned().notNullable().references('id').inTable('currencies')
      table.decimal('balance', 24, 8).notNullable().defaultTo(0)
      table.string('status').notNullable().defaultTo('active') // active | frozen | closed
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // one balance row per user per currency
      table.unique(['user_id', 'currency_id'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

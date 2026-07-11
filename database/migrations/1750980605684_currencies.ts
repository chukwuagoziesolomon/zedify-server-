import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('name', 255).notNullable()
      table.string('symbol', 10).notNullable().unique()
      table.string('logo', 500).nullable()
      table.integer('crypto_network_id').unsigned().references('id').inTable('crypto_networks').onDelete('CASCADE').nullable()
      table.enum('type', ['fiat', 'crypto']).notNullable()
      table.decimal('rate_per_usd', 20, 8).notNullable().defaultTo(0)
      table.string('contract_address', 255).nullable()

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

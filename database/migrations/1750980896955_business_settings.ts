import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_settings'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.integer('business_id').notNullable()
      table.text('test_private_key').nullable()
      table.text('test_public_key').nullable()
      table.text('live_private_key').nullable()
      table.text('live_public_key').nullable()
      table.string('test_webhook_url', 500).nullable()
      table.string('live_webhook_url', 500).nullable()
      table.enum('fee_bearer', ['business', 'customers']).notNullable().defaultTo('business')
      table.enum('current_environment', ['live', 'test']).notNullable().defaultTo('test')
      table.enum('payout_interval', ['instant', 'daily', 'weekly']).notNullable().defaultTo('daily')

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

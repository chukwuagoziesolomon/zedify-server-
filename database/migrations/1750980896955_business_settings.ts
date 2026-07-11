import BaseSchema from '@ioc:Adonis/Lucid/Schema'
import { FeeBearer, CurrentEnvironment, PayoutInterval } from 'App/Lib/types'

export default class extends BaseSchema {
  protected tableName = 'business_settings'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('business_id').notNullable().references('unique_id').inTable('users')
      table.text('test_private_key').nullable()
      table.text('test_public_key').nullable()
      table.text('live_private_key').nullable()
      table.text('live_public_key').nullable()
      table.string('test_webhook_url', 500).nullable()
      table.string('live_webhook_url', 500).nullable()
      table.string('fee_bearer').notNullable().defaultTo(FeeBearer.BUSINESS)
      table.string('current_environment').notNullable().defaultTo(CurrentEnvironment.TEST)
      table.string('payout_interval').notNullable().defaultTo(PayoutInterval.INSTANT)

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

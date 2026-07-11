import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'webhook_logs'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('business_id').notNullable()           // FK → users.unique_id
      table.string('event').notNullable()                 // e.g. payment.confirmed
      table.string('webhook_url').notNullable()
      table.string('environment').notNullable()           // LIVE | TEST
      table.json('payload').notNullable()                 // full payload sent
      table.integer('status_code').nullable()             // HTTP response code
      table.text('response_body').nullable()              // first 1000 chars of response
      table.integer('attempt').notNullable().defaultTo(1) // which retry attempt
      table.boolean('success').notNullable().defaultTo(false)
      table.text('error_message').nullable()
      table.timestamp('delivered_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

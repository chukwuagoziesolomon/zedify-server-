import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_accepted_sudt'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.integer('business_id').notNullable()
      table.foreign('business_id').references('id').inTable('users').onDelete('CASCADE')
      
      // SUDT token identification
      table.string('sudt_type_script', 255).notNullable()
      table.string('symbol', 50).notNullable()
      table.string('name', 255).notNullable()
      table.string('logo', 500).nullable()
      
      // Configuration
      table.boolean('enabled').defaultTo(true)
      table.boolean('auto_convert_enabled').defaultTo(false)
      
      // Tracking
      table.decimal('total_received', 30, 8).defaultTo(0)
      table.decimal('total_converted_to_usdt', 20, 2).defaultTo(0)
      table.timestamp('last_received_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

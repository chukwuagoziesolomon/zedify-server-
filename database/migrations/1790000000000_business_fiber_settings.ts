import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_fiber_settings'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.integer('business_id').notNullable().unique()
      table.foreign('business_id').references('id').inTable('users').onDelete('CASCADE')
      
      // Fiber channel configuration
      table.string('fiber_channel_id', 255).notNullable()
      table.string('fiber_peer_id', 255).notNullable()
      table.string('fiber_node_url', 500).notNullable()
      
      // Payment acceptance settings
      table.boolean('accept_ckb').defaultTo(true)
      table.boolean('accept_sudt').defaultTo(true)
      
      // Auto-conversion settings
      table.boolean('auto_convert_daily').defaultTo(false)
      table.decimal('auto_convert_threshold', 20, 8).nullable() // Minimum CKB before auto-convert
      table.string('settlement_schedule', 50).defaultTo('daily') // daily, weekly, monthly, manual
      
      // Settlement tracking
      table.decimal('total_received_ckb', 30, 8).defaultTo(0)
      table.decimal('total_received_usdt', 20, 2).defaultTo(0)
      table.decimal('total_fees_paid', 20, 2).defaultTo(0)
      
      // Status management
      table.string('status', 50).defaultTo('active')
      table.timestamp('last_settled_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

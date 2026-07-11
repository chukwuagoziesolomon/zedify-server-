import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payment_channels'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('business_id', 255).notNullable()
      table.string('channel_id', 1000).notNullable() // Increased to accommodate long Fiber channel IDs
      table.string('peer_id', 1000).notNullable() // Increased to accommodate long Fiber peer IDs
      table.text('local_balance').defaultTo('0x0') // Changed to text for large hex numbers
      table.text('remote_balance').defaultTo('0x0') // Changed to text for large hex numbers
      table.string('currency', 50).defaultTo('Fibt')
      table.string('state', 50).defaultTo('pending')
      table.boolean('is_public').defaultTo(true)
      table.boolean('is_one_way').defaultTo(false)
      table.string('channel_outpoint').nullable()
      table.string('funding_tx_hash').nullable()
      table.timestamp('funded_at', { useTz: true }).nullable()
      table.timestamp('closed_at', { useTz: true }).nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

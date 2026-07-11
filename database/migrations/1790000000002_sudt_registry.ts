import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'sudt_registry'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      
      // SUDT token identification (unique per network)
      table.string('type_script', 255).notNullable().unique()
      table.string('symbol', 50).notNullable()
      table.string('name', 255).notNullable()
      table.integer('decimals').defaultTo(8)
      
      // Token metadata
      table.string('logo', 500).nullable()
      table.text('description').nullable()
      table.string('network', 50).defaultTo('testnet') // testnet, mainnet
      table.string('issuer', 255).nullable()
      
      // Management
      table.boolean('enabled').defaultTo(true)
      table.boolean('is_popular').defaultTo(false)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

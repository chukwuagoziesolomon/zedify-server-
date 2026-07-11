import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('crypto_network_id').notNullable()
      table.string('user_id').notNullable()
      table.string('wallet_address', 255).notNullable().unique()
      table.string('qr_code_url', 512)
      table.string('type').notNullable()
      table.string('ref_id', 255).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.boolean('reusable').defaultTo(false)
      table.string('status', 64).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

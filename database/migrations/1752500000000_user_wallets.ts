import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UserWallets extends BaseSchema {
  protected tableName = 'user_wallets'

  async up() {
    // Drop enum if it exists from previous runs
    await this.schema.raw('DROP TYPE IF EXISTS user_wallet_status CASCADE')
    
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .string('unique_id')
        .unique()
        .notNullable()
        .comment('Unique identifier for the wallet')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .comment('User who owns this wallet')

      table
        .string('crypto_network_id')
        .notNullable()
        .references('unique_id')
        .inTable('crypto_networks')
        .onDelete('RESTRICT')
        .comment('Blockchain network (BSC, Polygon, Ethereum, Base, etc.)')

      table
        .string('currency_id')
        .notNullable()
        .references('unique_id')
        .inTable('currencies')
        .onDelete('RESTRICT')
        .comment('USDT or other stablecoin')

      table
        .string('wallet_address')
        .notNullable()
        .comment('Blockchain wallet address for this user on this network')

      table
        .decimal('balance', 20, 6)
        .notNullable()
        .defaultTo(0)
        .comment('Current USDT balance')

      table
        .decimal('total_deposited', 20, 6)
        .notNullable()
        .defaultTo(0)
        .comment('Total USDT received since account creation')

      table
        .decimal('total_withdrawn', 20, 6)
        .notNullable()
        .defaultTo(0)
        .comment('Total USDT transferred/withdrawn since account creation')

      table
        .enum('status', ['active', 'inactive', 'archived'], {
          useNative: true,
          enumName: 'user_wallet_status',
        })
        .notNullable()
        .defaultTo('active')
        .comment('Wallet status: active (can transfer), inactive (no activity), archived (deleted)')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Indexes
      table.index(['user_id'])
      table.index(['crypto_network_id'])
      table.index(['currency_id'])
      table.index(['status'])
      table.unique(['user_id', 'crypto_network_id'], { indexName: 'user_wallet_unique' })
      table.comment('User permanent USDT savings wallets')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    // Drop the enum type as well
    this.schema.raw('DROP TYPE IF EXISTS user_wallet_status CASCADE')
  }
}

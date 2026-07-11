import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class BalanceLedgers extends BaseSchema {
  protected tableName = 'balance_ledgers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .string('unique_id')
        .unique()
        .notNullable()
        .comment('Unique identifier for ledger entry')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .comment('User who owns the wallet')

      table
        .integer('user_wallet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('user_wallets')
        .onDelete('CASCADE')
        .comment('Wallet whose balance changed')

      table
        .enum('type', ['deposit', 'transfer', 'fee', 'refund', 'adjustment'], {
          useNative: true,
          enumName: 'ledger_transaction_type',
        })
        .notNullable()
        .comment('Type of transaction')

      table
        .decimal('amount', 20, 6)
        .notNullable()
        .comment('Amount involved (always positive)')

      table
        .decimal('balance_after', 20, 6)
        .notNullable()
        .comment('Wallet balance after this transaction')

      table
        .string('reference')
        .notNullable()
        .comment('Reference ID (Transfer ID, Deposit ID, etc)')

      table
        .text('description')
        .notNullable()
        .comment('Human-readable description of transaction')

      table
        .integer('transfer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('transfers')
        .onDelete('SET NULL')
        .comment('Related transfer if applicable')

      table
        .enum('status', ['pending', 'completed', 'failed'], {
          useNative: true,
          enumName: 'ledger_status',
        })
        .notNullable()
        .defaultTo('completed')
        .comment('Ledger entry status')

      table
        .text('metadata')
        .nullable()
        .comment('JSON metadata for additional context')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Indexes
      table.index(['user_id'])
      table.index(['user_wallet_id'])
      table.index(['type'])
      table.index(['reference'])
      table.index(['created_at'])
      table.comment('Audit trail for all balance changes')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Transfers extends BaseSchema {
  protected tableName = 'transfers'

  async up() {
    // Drop enums if they exist from previous runs
    await this.schema.raw('DROP TYPE IF EXISTS transfer_recipient_type CASCADE')
    await this.schema.raw('DROP TYPE IF EXISTS transfer_status CASCADE')
    
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .string('unique_id')
        .unique()
        .notNullable()
        .comment('Unique identifier for the transfer')

      table
        .integer('sender_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .comment('User initiating the transfer')

      table
        .integer('user_wallet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('user_wallets')
        .onDelete('CASCADE')
        .comment('USDT wallet being debited')

      table
        .decimal('usdt_amount', 20, 6)
        .notNullable()
        .comment('USDT amount transferred (after fee)')

      table
        .decimal('exchange_rate', 20, 2)
        .notNullable()
        .comment('USDT to NGN rate at time of transfer')

      table
        .decimal('naira_amount', 15, 2)
        .notNullable()
        .comment('Naira (NGN) equivalent amount')

      table
        .decimal('fee', 20, 6)
        .notNullable()
        .defaultTo(0)
        .comment('Platform fee (usually 1% of USDT amount)')

      table
        .enum('recipient_type', ['bank_account', 'user_usdt', 'merchant'], {
          useNative: true,
          enumName: 'transfer_recipient_type',
        })
        .notNullable()
        .comment('Where the transfer is going: bank account, another user, or merchant')

      // Recipient details - nullable based on type
      table
        .string('recipient_name')
        .nullable()
        .comment('Name of transfer recipient')

      table
        .string('recipient_account_number')
        .nullable()
        .comment('Bank account number (for bank_account type)')

      table
        .string('recipient_bank_code')
        .nullable()
        .comment('Bank code (for bank_account type)')

      table
        .integer('recipient_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .comment('Recipient user ID (for user_usdt type)')

      table
        .string('recipient_reference')
        .nullable()
        .comment('Merchant reference or custom identifier (for merchant type)')

      table
        .text('purpose')
        .nullable()
        .comment('Transfer purpose/description')

      table
        .string('bank_transfer_ref')
        .nullable()
        .comment('Bank transfer reference/transaction ID')

      // Status workflow
      table
        .enum(
          'status',
          ['pending', 'processing', 'completed', 'failed', 'cancelled'],
          {
            useNative: true,
            enumName: 'transfer_status',
          }
        )
        .notNullable()
        .defaultTo('pending')
        .comment('Transfer status: pending → processing → completed/failed')

      // Timestamps
      table
        .timestamp('initiated_at', { useTz: true })
        .notNullable()
        .defaultTo(this.now())
        .comment('When user initiated transfer')

      table
        .timestamp('processed_at', { useTz: true })
        .nullable()
        .comment('When transfer started settlement')

      table
        .timestamp('completed_at', { useTz: true })
        .nullable()
        .comment('When transfer completed')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Indexes
      table.index(['sender_user_id'])
      table.index(['user_wallet_id'])
      table.index(['status'])
      table.index(['recipient_type'])
      table.index(['initiated_at'])
      table.index(['completed_at'])
      table.comment('USDT transfer records with conversion tracking')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

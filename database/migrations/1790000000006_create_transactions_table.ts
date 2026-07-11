import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class CreateTransactionsTable extends BaseSchema {
  protected tableName = 'transactions'

  public async up() {
    // Drop existing table if it exists to ensure clean schema
    await this.schema.raw('DROP TABLE IF EXISTS transactions CASCADE')
    
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').unique().notNullable().index()

      // Core transaction data
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('user_wallet_id').nullable() // References UserWallet.uniqueId (app-level enforcement)
      table.enum('type', ['receive', 'withdrawal']).notNullable().index() // receive or withdrawal
      table.enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled']).notNullable().defaultTo('pending').index()

      // Amount & currency
      table.string('crypto_network_id').nullable() // CryptoNetwork.uniqueId
      table.string('currency_id').nullable() // Currency.uniqueId
      table.decimal('amount_crypto', 20, 8).notNullable() // e.g. 2000.00000000 CKB
      table.decimal('amount_usd', 20, 8).notNullable() // USD equivalent
      table.decimal('platform_fee_usd', 20, 8).defaultTo(0) // 5% fee
      table.decimal('net_amount_usd', 20, 8).notNullable() // credited to wallet

      // Address/recipient tracking
      table.text('wallet_address_generated').nullable() // Generated CKB/EVM address for customer
      table.text('recipient_address').nullable() // For withdrawals: where funds go
      table.text('sender_address').nullable() // For receives: where funds came from (on-chain)
      table.text('qr_code_data').nullable() // base64 encoded QR code

      // Blockchain tracking
      table.string('tx_hash', 255).nullable().index() // Transaction hash
      table.string('payment_hash', 255).nullable().index() // Fiber payment hash
      table.text('invoice_address').nullable() // Fiber invoice address
      table.text('sudt_type_script').nullable() // SUDT token details
      table.integer('block_number').unsigned().nullable() // Block confirmation
      table.integer('confirmations').unsigned().nullable().defaultTo(0)

      // Business/Reference tracking
      table.string('payment_intent_id').nullable() // References PaymentIntent.uniqueId (app-level enforcement)
      table.string('withdrawal_id').nullable() // Will be added when Withdrawal model created
      table.string('reference_id').nullable().index() // External order/deposit ID
      table.text('description').nullable() // Purpose/memo

      // Status tracking
      table.text('error_message').nullable() // Failure reason
      table.integer('retry_count').unsigned().defaultTo(0)
      table.timestamp('expires_at').nullable() // When address/invoice expires

      // Timestamps
      table.timestamp('initiated_at').notNullable()
      table.timestamp('processed_at').nullable()
      table.timestamp('completed_at').nullable()
      table.timestamps()

      // Indexes for common queries
      table.index(['user_id', 'status'])
      table.index(['user_id', 'type'])
      table.index(['user_wallet_id', 'status'])
      table.index(['crypto_network_id', 'status'])
      table.index(['created_at'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

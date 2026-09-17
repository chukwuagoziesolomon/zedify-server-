import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_settings'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('auto_settlement_enabled').notNullable().defaultTo(false)
      table.string('auto_settlement_time', 10).notNullable().defaultTo('18:00')
      table.string('payout_method', 20).notNullable().defaultTo('wallet')
      table.string('payout_wallet_id').nullable()
      table.string('payout_currency_id').nullable()
      table.string('payout_bank_account_no').nullable()
      table.string('payout_bank_name').nullable()
      table.string('payout_account_name').nullable()
      table.string('payout_bank_code').nullable()
      table.timestamp('last_payout_at').nullable()
      table.string('last_payout_status').nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('auto_settlement_enabled')
      table.dropColumn('auto_settlement_time')
      table.dropColumn('payout_method')
      table.dropColumn('payout_wallet_id')
      table.dropColumn('payout_currency_id')
      table.dropColumn('payout_bank_account_no')
      table.dropColumn('payout_bank_name')
      table.dropColumn('payout_account_name')
      table.dropColumn('payout_bank_code')
      table.dropColumn('last_payout_at')
      table.dropColumn('last_payout_status')
    })
  }
}

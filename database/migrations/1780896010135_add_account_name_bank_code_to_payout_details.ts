import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'payout_details'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('account_name').nullable()
      table.string('bank_code').nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('account_name')
      table.dropColumn('bank_code')
    })
  }
}

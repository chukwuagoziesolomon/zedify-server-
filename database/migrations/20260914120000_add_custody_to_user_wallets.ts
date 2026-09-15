import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AddCustodyToUserWallets extends BaseSchema {
  protected tableName = 'user_wallets'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('encrypted_private_key').nullable()
      table.string('key_version', 32).nullable()
      table.string('custody_status', 32).notNullable().defaultTo('custodial')
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('encrypted_private_key')
      table.dropColumn('key_version')
      table.dropColumn('custody_status')
    })
  }
}
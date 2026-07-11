import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_settings'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('test_key_expires_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('test_key_expires_at')
    })
  }
}

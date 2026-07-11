import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'system_settings_tb'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('platform_fee_percentage', 5, 2).notNullable().defaultTo(5).comment('Platform fee percentage applied to transactions')
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('platform_fee_percentage')
    })
  }
}

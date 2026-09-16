import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'carts'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('shop_id').nullable().references('unique_id').inTable('shops').onDelete('SET NULL')
      table.string('guest_token').nullable().unique()
      table.index(['user_id'])
      table.index(['guest_token'])
      table.index(['shop_id'])
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id'])
      table.dropIndex(['guest_token'])
      table.dropIndex(['shop_id'])
      table.dropColumn('shop_id')
      table.dropColumn('guest_token')
    })
  }
}

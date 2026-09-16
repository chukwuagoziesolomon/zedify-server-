import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shop_delivery_settings'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('delivery_fee_currency', 10).nullable().comment('ISO currency code for delivery_fee, defaults to shop currency')
      table.decimal('delivery_fee_usd', 10, 4).nullable().comment('USD equivalent of delivery_fee, for crypto checkout conversion')
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('delivery_fee_currency')
      table.dropColumn('delivery_fee_usd')
    })
  }
}

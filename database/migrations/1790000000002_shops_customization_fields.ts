import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shops'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('shop_type').notNullable().defaultTo('default')
      table.string('template').nullable()
      table.boolean('customization_access_paid').notNullable().defaultTo(false)
      table.timestamp('customization_access_paid_at', { useTz: true }).nullable()
      table.string('customization_payment_reference_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('customization_payment_reference_id')
      table.dropColumn('customization_access_paid_at')
      table.dropColumn('customization_access_paid')
      table.dropColumn('template')
      table.dropColumn('shop_type')
    })
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'user_wallets'

  public async up() {
    this.schema.table(this.tableName, (table) => {
      table.decimal('total_fiber_received', 20, 6).defaultTo(0).after('total_withdrawn')
    })
  }

  public async down() {
    this.schema.table(this.tableName, (table) => {
      table.dropColumn('total_fiber_received')
    })
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shops'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('features').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('features')
    })
  }
}

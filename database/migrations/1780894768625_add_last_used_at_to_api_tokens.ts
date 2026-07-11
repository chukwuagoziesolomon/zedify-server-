import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'api_tokens'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('last_used_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_used_at')
    })
  }
}

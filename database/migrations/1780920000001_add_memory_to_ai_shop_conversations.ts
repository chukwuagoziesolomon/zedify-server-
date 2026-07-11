import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'ai_shop_conversations'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      // Summary memory — AI-generated compression of messages older than buffer window
      table.text('summary_memory').nullable()
      // Entity memory — extracted key facts: colors, style, products mentioned, preferences
      table.json('entity_memory').nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('summary_memory')
      table.dropColumn('entity_memory')
    })
  }
}

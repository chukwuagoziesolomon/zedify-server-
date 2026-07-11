import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'ai_shop_conversations'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('shop_id').notNullable().references('unique_id').inTable('shops').onDelete('CASCADE')
      // Full message history including reasoning_details preserved for multi-turn memory
      table.json('messages').notNullable().defaultTo('[]')
      table.string('last_action').nullable()           // last thing the AI helped with
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

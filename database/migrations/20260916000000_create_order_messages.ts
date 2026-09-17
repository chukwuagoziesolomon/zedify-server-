import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'order_messages'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('payment_intent_id').notNullable().references('unique_id').inTable('payment_intent_tb').onDelete('CASCADE')
      table.string('sender_id').notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('sender_type').notNullable().defaultTo('customer')
      table.text('message').notNullable()
      table.boolean('is_read').notNullable().defaultTo(false)
      table.timestamp('read_at').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.index(['payment_intent_id'])
      table.index(['sender_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

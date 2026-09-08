import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'user_identities'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('provider', 50).notNullable()
      table.string('network', 50).notNullable()
      table.string('subject', 255).notNullable()
      table.text('lock_script').nullable()
      table.text('public_key').nullable()
      table.timestamp('verified_at', { useTz: true }).notNullable()
      table.timestamp('last_authenticated_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['provider', 'network', 'subject'])
      table.index(['user_id'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'external_auth_challenges'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('challenge_id', 100).notNullable().unique()
      table.string('provider', 50).notNullable()
      table.string('network', 50).notNullable()
      table.text('subject').notNullable()
      table.text('message').notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['provider', 'network', 'subject'])
      table.index(['expires_at'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
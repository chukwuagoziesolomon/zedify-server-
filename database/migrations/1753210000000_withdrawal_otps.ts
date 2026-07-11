import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'withdrawal_otps'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('user_id', 255).notNullable()           // FK → users.unique_id
      table.string('otp_code', 6).notNullable()
      table.string('withdrawal_type', 10).notNullable()    // 'crypto' | 'fiat'
      table.json('withdrawal_payload').notNullable()        // full withdrawal params serialised
      table.boolean('used').notNullable().defaultTo(false)
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

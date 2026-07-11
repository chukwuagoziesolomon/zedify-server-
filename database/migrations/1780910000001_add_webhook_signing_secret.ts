import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_settings'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      // Per-merchant webhook signing secret (HMAC-SHA256)
      table.string('webhook_signing_secret', 64).nullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('webhook_signing_secret')
    })
  }
}

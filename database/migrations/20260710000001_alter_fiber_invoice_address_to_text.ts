import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'fiber_invoices'

  public async up() {
    await this.schema.raw('ALTER TABLE fiber_invoices ALTER COLUMN invoice_address TYPE text')
  }

  public async down() {
    await this.schema.raw('ALTER TABLE fiber_invoices ALTER COLUMN invoice_address TYPE varchar(255)')
  }
}

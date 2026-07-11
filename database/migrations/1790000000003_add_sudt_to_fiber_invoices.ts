import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'fiber_invoices'

  public async up() {
    // Check if fiber_invoices table exists before adding columns
    const hasTable = (await this.schema.raw(
      `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = '${this.tableName}')`
    )) as unknown as { rows: { exists: boolean }[] }
    
    if (hasTable.rows[0].exists) {
      this.schema.table(this.tableName, (table) => {
        table.decimal('amount_sudt', 30, 8).nullable().after('amount_ckb')
        table.text('sudt_type_script').nullable().after('amount_sudt')
      })
    }
  }

  public async down() {
    // Check if table exists before dropping columns
    const hasTable = (await this.schema.raw(
      `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = '${this.tableName}')`
    )) as unknown as { rows: { exists: boolean }[] }
    
    if (hasTable.rows[0].exists) {
      this.schema.table(this.tableName, (table) => {
        table.dropColumn('amount_sudt')
        table.dropColumn('sudt_type_script')
      })
    }
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_stablecoin').defaultTo(false)
      table.string('peg_target').nullable()      // e.g. "USD"
      table.string('pegged_by').nullable()        // e.g. "Tether", "Circle", "CKB / Fiber ecosystem"
      table.text('backing_info').nullable()        // short disclosure blurb shown at selection time
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_stablecoin')
      table.dropColumn('peg_target')
      table.dropColumn('pegged_by')
      table.dropColumn('backing_info')
    })
  }
}

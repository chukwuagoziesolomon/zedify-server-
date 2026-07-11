import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'business_fiber_settings'

  public async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'fiber_node_url')
    if (!hasColumn) {
      this.schema.table(this.tableName, (table) => {
        table.string('fiber_node_url', 500).defaultTo('http://127.0.0.1:8227').after('fiber_peer_id')
      })
    }
  }

  public async down() {
    this.schema.table(this.tableName, (table) => {
      table.dropColumn('fiber_node_url')
    })
  }
}

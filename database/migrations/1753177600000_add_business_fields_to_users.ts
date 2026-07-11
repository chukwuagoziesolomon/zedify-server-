import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.table(this.tableName, (table) => {
      table.string('phone', 15).nullable().after('password')
      table.enum('business_type', ['starter', 'registered']).defaultTo('starter').after('business_name')
      table.string('bvn', 11).nullable().after('business_type')
      table.string('cac_number', 255).nullable().after('bvn')
      table.json('cac_documents').nullable().after('cac_number')
      table.json('shareholders_approval_letter').nullable().after('cac_documents')
    })
  }

  public async down() {
    this.schema.table(this.tableName, (table) => {
      table.dropColumn('phone')
      table.dropColumn('business_type')
      table.dropColumn('bvn')
      table.dropColumn('cac_number')
      table.dropColumn('cac_documents')
      table.dropColumn('shareholders_approval_letter')
    })
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'crypto_networks'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // 'evm' for all EVM-compatible chains, 'ckb' for Nervos CKB
      table.string('network_type', 20).notNullable().defaultTo('evm')
      // Chain ID used for EVM webhook validation (e.g. 1=Ethereum, 56=BSC, 137=Polygon)
      table.integer('chain_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('network_type')
      table.dropColumn('chain_id')
    })
  }
}

import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shops'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('unique_id').notNullable().unique()
      table.string('user_id').notNullable().references('unique_id').inTable('users').onDelete('CASCADE')
      table.string('business_name').notNullable()
      table.string('subdomain').notNullable().unique() // e.g. "nike" → nike.yourdomain.com
      table.text('description').nullable()
      table.string('logo_url').nullable()
      table.string('logo_public_id').nullable()
      table.string('banner_url').nullable()
      table.string('banner_public_id').nullable()
      table.json('theme_config').nullable()            // colors, fonts, layout preferences
      table.json('pages_config').nullable()            // AI-generated page structure
      table.string('status').notNullable().defaultTo('draft') // draft | published
      table.string('currency').notNullable().defaultTo('NGN')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}

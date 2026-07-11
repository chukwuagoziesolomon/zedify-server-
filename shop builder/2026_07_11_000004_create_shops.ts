import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'shops'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.uuid('unique_id').notNullable().unique()
      table.integer('owner_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')

      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table.string('primary_category').notNullable() // 'food' | 'fashion' | 'gadgets' | 'vehicles' | ...

      // theming — matches the Yanga default template's CSS variable slots
      table.string('template').notNullable().defaultTo('yanga-default')
      table.string('logo_url').nullable()
      table.string('color_primary').notNullable().defaultTo('#1C2B4A')
      table.string('color_accent').notNullable().defaultTo('#E14B3D')
      table.string('color_highlight').notNullable().defaultTo('#F2A93B')

      // per-shop checkout settings — owner's call, not platform-wide
      table.boolean('allow_pay_on_delivery').notNullable().defaultTo(false)
      table.json('accepted_currency_ids').nullable() // which Currency ids this shop accepts at checkout

      table.boolean('is_custom_ai_theme').notNullable().defaultTo(false) // false = free default template tier
      table.string('status').notNullable().defaultTo('active') // active | suspended | draft

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      table.index(['owner_id'])
      table.index(['primary_category'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

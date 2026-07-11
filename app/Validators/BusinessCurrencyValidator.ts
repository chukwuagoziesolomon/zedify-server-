import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class BusinessCurrencyValidator {
  public schema = schema.create({
    currency_id: schema.string([rules.exists({ table: 'currencies', column: 'unique_id' })]),
  })

  public messages = {
    'currency_id.required': 'currency_id is required',
    'currency_id.exists': 'currency_id must exist in currencies',
  }
}

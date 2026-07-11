import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class PaymentIntentValidator {
  public schema = schema.create({
    fiat_amount: schema.number([rules.unsigned()]),
    fiat_currency: schema.string(), // Add more as needed
    reference_id: schema.string({}, [
      rules.unique({ table: 'payment_intent_tb', column: 'business_reference_id' }),
    ]),
  })

  public messages = {
    'fiat_amount.number': 'fiat_amount must be a number',
    'fiat_amount.unsigned': 'fiat_amount must be positive',
    'fiat_currency.enum': 'fiat_currency must be a supported currency',
    'reference_id.unique': 'reference_id must be unique',
  }
}

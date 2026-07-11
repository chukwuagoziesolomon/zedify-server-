import { schema, rules } from '@ioc:Adonis/Core/Validator'

export class CreatePaymentLinkValidator {
  public schema = schema.create({
    title: schema.string({ trim: true }),
    description: schema.string.optional({ trim: true }),
    fiat_currency: schema.string.optional(),
    fiat_amount: schema.number.optional([rules.unsigned()]),
    is_single_use: schema.boolean.optional(),
    usage_limit: schema.number.optional([rules.unsigned()]),
    expires_at: schema.date.optional(),
  })

  public messages = {
    'title.required': 'title is required',
    'fiat_amount.unsigned': 'fiat_amount must be a positive number',
    'usage_limit.unsigned': 'usage_limit must be a positive number',
  }
}

export class UpdatePaymentLinkValidator {
  public schema = schema.create({
    title: schema.string.optional({ trim: true }),
    description: schema.string.optional({ trim: true }),
    fiat_amount: schema.number.optional([rules.unsigned()]),
    status: schema.enum.optional(['active', 'inactive'] as const),
    is_single_use: schema.boolean.optional(),
    usage_limit: schema.number.optional([rules.unsigned()]),
    expires_at: schema.date.optional(),
  })

  public messages = {
    'fiat_amount.unsigned': 'fiat_amount must be a positive number',
    'usage_limit.unsigned': 'usage_limit must be a positive number',
    'status.enum': 'status must be one of: active, inactive',
  }
}

export class CheckoutPaymentLinkValidator {
  public schema = schema.create({
    fiat_amount: schema.number.optional([rules.unsigned()]),
  })

  public messages = {
    'fiat_amount.unsigned': 'fiat_amount must be a positive number',
  }
}

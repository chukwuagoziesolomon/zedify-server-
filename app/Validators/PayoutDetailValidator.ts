import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { PayoutType } from 'App/Lib/types'

export default class PayoutDetailValidator {
  public schema = schema.create({
    type: schema.enum(Object.values(PayoutType)),
    network_id: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.CRYPTO),
    ]),
    wallet_address: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.CRYPTO),
    ]),
    currency_id: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.FIAT),
    ]),
    bank_account_no: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.FIAT),
    ]),
    bank_name: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.FIAT),
    ]),
    account_name: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.FIAT),
    ]),
    bank_code: schema.string.optional({}, [
      rules.requiredWhen('type', '=', PayoutType.FIAT),
    ]),
  })

  public messages = {
    'type.enum': 'type must be CRYPTO or FIAT',
    'network_id.requiredWhen': 'network_id is required for CRYPTO payout',
    'wallet_address.requiredWhen': 'wallet_address is required for CRYPTO payout',
    'currency_id.requiredWhen': 'currency_id is required for FIAT payout',
    'bank_account_no.requiredWhen': 'bank_account_no is required for FIAT payout',
    'bank_name.requiredWhen': 'bank_name is required for FIAT payout',
    'account_name.requiredWhen': 'account_name is required for FIAT payout',
    'bank_code.requiredWhen': 'bank_code is required for FIAT payout',
  }
}

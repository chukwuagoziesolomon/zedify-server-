import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { FeeBearer, CurrentEnvironment, PayoutInterval } from 'App/Lib/types'

export default class SettingsGeneralValidator {
  public schema = schema.create({
    fee_bearer: schema.enum.optional(Object.values(FeeBearer)),
    current_environment: schema.enum.optional(Object.values(CurrentEnvironment)),
    payout_interval: schema.enum.optional(Object.values(PayoutInterval)),
    payout_type: schema.enum.optional(['CRYPTO', 'FIAT']),
    auto_settlement_enabled: schema.boolean.optional(),
    auto_settlement_time: schema.string.optional({}, [rules.minLength(5), rules.maxLength(5)]),
    payout_method: schema.enum.optional(['wallet', 'bank']),
    payout_wallet_id: schema.string.optional({}, [
      rules.requiredWhen('payout_method', '=', 'wallet'),
    ]),
    payout_currency_id: schema.string.optional(),
    payout_bank_account_no: schema.string.optional({}, [
      rules.requiredWhen('payout_method', '=', 'bank'),
    ]),
    payout_bank_name: schema.string.optional({}, [
      rules.requiredWhen('payout_method', '=', 'bank'),
    ]),
    payout_account_name: schema.string.optional(),
    payout_bank_code: schema.string.optional({}, [
      rules.requiredWhen('payout_method', '=', 'bank'),
    ]),
  })

  public messages = {
    'fee_bearer.enum': 'fee_bearer must be BUSINESS or CUSTOMERS',
    'current_environment.enum': 'current_environment must be LIVE or TEST',
    'payout_interval.enum': 'payout_interval must be INSTANT, DAILY, or WEEKLY',
    'payout_type.enum': 'payout_type must be CRYPTO or FIAT',
    'payout_method.enum': 'payout_method must be wallet or bank',
    'payout_wallet_id.requiredWhen': 'payout_wallet_id is required when payout_method is wallet',
    'payout_bank_account_no.requiredWhen': 'payout_bank_account_no is required when payout_method is bank',
    'payout_bank_name.requiredWhen': 'payout_bank_name is required when payout_method is bank',
    'payout_bank_code.requiredWhen': 'payout_bank_code is required when payout_method is bank',
  }
}

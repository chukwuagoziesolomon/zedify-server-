import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { FeeBearer, CurrentEnvironment, PayoutInterval } from 'App/Lib/types'

export default class SettingsGeneralValidator {
  public schema = schema.create({
    fee_bearer: schema.enum.optional(Object.values(FeeBearer)),
    current_environment: schema.enum.optional(Object.values(CurrentEnvironment)),
    payout_interval: schema.enum.optional(Object.values(PayoutInterval)),
    payout_type: schema.enum.optional(['CRYPTO', 'FIAT']),
  })

  public messages = {
    'fee_bearer.enum': 'fee_bearer must be BUSINESS or CUSTOMERS',
    'current_environment.enum': 'current_environment must be LIVE or TEST',
    'payout_interval.enum': 'payout_interval must be INSTANT, DAILY, or WEEKLY',
    'payout_type.enum': 'payout_type must be CRYPTO or FIAT',
  }
}

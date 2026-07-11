import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class SignupValidator {
  public schema = schema.create({
    email: schema.string([
      rules.email(),
      rules.unique({ table: 'users', column: 'email' })
    ]),
    password: schema.string([
      rules.confirmed(),
      rules.minLength(4)
    ]),
    password_confirmation: schema.string(),
    phone: schema.string.optional([
      rules.maxLength(15),
      rules.unique({ table: 'users', column: 'phone' })
    ]),
    business_name: schema.string([
      rules.minLength(2),
      rules.maxLength(255)
    ])
  })

  public messages = {
    'email.required': 'Email is required',
    'email.email': 'Please provide a valid email address',
    'email.unique': 'This email is already registered',
    'password.required': 'Password is required',
    'password.confirmed': 'Password confirmation does not match',
    'password.minLength': 'Password must be at least 4 characters',
    'password_confirmation.required': 'Password confirmation is required',
    'password_confirmation.confirmed': 'Password confirmation does not match',
    'phone.maxLength': 'Phone number is too long',
    'phone.unique': 'This phone number is already registered',
    'business_name.required': 'Business name is required',
    'business_name.minLength': 'Business name must be at least 2 characters',
    'business_name.maxLength': 'Business name is too long'
  }
}

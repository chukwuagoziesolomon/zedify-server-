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
    phone: schema.string([
      rules.maxLength(15),
      rules.unique({ table: 'users', column: 'phone' })
    ]),
    business_name: schema.string([
      rules.minLength(2),
      rules.maxLength(255)
    ]),
    business_type: schema.enum(['starter', 'registered']),
    bvn: schema.string([
      rules.minLength(11),
      rules.maxLength(11)
    ]),
    cac_number: schema.string.optional([
      rules.minLength(5),
      rules.maxLength(255)
    ]),
    // File uploads are handled differently - not through validation schema
    // They are processed directly from request.file()
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
    'phone.required': 'Phone number is required',
    'phone.maxLength': 'Phone number is too long',
    'phone.unique': 'This phone number is already registered',
    'business_name.required': 'Business name is required',
    'business_name.minLength': 'Business name must be at least 2 characters',
    'business_name.maxLength': 'Business name is too long',
    'business_type.required': 'Business type is required',
    'business_type.enum': 'Business type must be either starter or registered',
    'bvn.required': 'BVN is required',
    'bvn.minLength': 'BVN must be exactly 11 digits',
    'bvn.maxLength': 'BVN must be exactly 11 digits',
    'cac_number.minLength': 'CAC number must be at least 5 characters',
    'cac_number.maxLength': 'CAC number is too long',
  }
}

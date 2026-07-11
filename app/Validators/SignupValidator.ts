import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class SignupValidator {
  public schema = schema.create({
    email: schema.string({ trim: true }, [
      rules.email(),
      rules.unique({ table: 'users', column: 'email' })
    ]),
    password: schema.string({ trim: true }, [
      rules.confirmed(),
      rules.minLength(4)
    ]),
    password_confirmation: schema.string({ trim: true }),
    phone: schema.string({ trim: true }, [
      rules.maxLength(15),
      rules.unique({ table: 'users', column: 'phone' })
    ]),
    business_name: schema.string({ trim: true }, [
      rules.minLength(2),
      rules.maxLength(255)
    ]),
    business_type: schema.enum(['starter', 'registered'] as const),
    bvn: schema.string({ trim: true }, [
      rules.regex(/^[0-9]{11}$/),
    ]),
    cac_number: schema.string.optional({ trim: true }, [
      rules.requiredIf('business_type', 'registered'),
      rules.minLength(5),
      rules.maxLength(255),
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
    'bvn.regex': 'BVN must be exactly 11 digits',
    'cac_number.requiredIf': 'CAC number is required for registered businesses',
    'cac_number.minLength': 'CAC number must be at least 5 characters',
    'cac_number.maxLength': 'CAC number is too long',
  }
}

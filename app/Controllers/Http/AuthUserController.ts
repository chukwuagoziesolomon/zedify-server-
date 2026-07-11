import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from "App/Models/User";
import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils';
import { createHmac } from "crypto";
import Env from '@ioc:Adonis/Core/Env'
// import bcrypt from "bcryptjs";


import { NotificationService } from 'App/Lib/notification/notification'
import Admin from 'App/Models/Admin';
import SignupValidator from 'App/Validators/SignupValidator';

const jwtConstants = {
  secret: Env.get('JWT_KEY'),
};

export default class AuthUserController {
  protected notificationService: NotificationService

  constructor() {
    this.notificationService = new NotificationService()
  }


  private async validate(request) {
    const transactionSchema = schema.create({
      password: schema.string([
        rules.confirmed(),
        rules.minLength(4)
      ]),
      email: schema.string([
        rules.email(),
        rules.unique({ table: 'users', column: 'email' })
      ]),
      phone: schema.string([
        rules.maxLength(15),
        rules.unique({ table: 'users', column: 'phone' })
      ]),
      business_name: schema.string([
        rules.minLength(2),
        rules.maxLength(255)
      ])
    })
    const messages = {
      required: 'The {{ field }} is required.',
      unique: 'This {{ field }} already exists.'
    }
    await request.validate({ schema: transactionSchema, messages });
  }

  public async signup({ request, response }: HttpContextContract) {
    try {
      const payload = await request.validate(SignupValidator)

      let result = await User.create({
        email: payload.email,
        password: payload.password,
        phone: payload.phone || undefined,
        businessName: payload.business_name,
      });

      if (result !== null) {
        response.status(200).json(await formatSuccessMessage("User created!", result));
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async login({ auth, request, response }: HttpContextContract) {
    try {
      const email = request.input('email')
      const password = request.input('password')

      const token = await auth.use('user').attempt(email, password, {
        expiresIn: '12 hrs'  // 12 hrs
      })
      response.status(200).json(await formatSuccessMessage("Login successful", token))
    } catch (error) {
      console.error(error)
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async adminForgotPassword({ request, response }: HttpContextContract) {
    try {
      const email = request.input('email');

      const _schema = schema.create({
        email: schema.string({ trim: true }),
      })
      const messages = { required: 'The {{ field }} is required.' }
      await request.validate({ schema: _schema, messages });

      const admin = await Admin.findBy('email', email);

      if (!admin) {
        throw new Error('This admin does not exist');
      }

      if (!jwtConstants || !jwtConstants.secret) {
        throw new Error('JWT secret is not configured');
      }

      const otp = Math.floor(100000 + Math.random() * 900000);
      const ttl = 5 * 60 * 1000; // 5 mins in ms

      const expires = Date.now() + ttl; // in 5 mins

      const data = `${email}.${otp}.${expires}`;
      const hash = createHmac("sha256", jwtConstants.secret).update(data).digest("hex");
      const fullHash = `${hash}.${expires}`;

      const emailSent = await this.notificationService.sendEmail({
        to: email,
        subject: 'Reset your admin password',
        template: "password_reset",
        replacements: { code: otp },
      });
      if (!emailSent) {
        throw new Error('Failed to send password reset email');
      }

      response.status(200).json(await formatSuccessMessage('Password reset link sent to your email.', fullHash));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async adminResetPassword({ request, response }: HttpContextContract) {
    try {
      const requestBody = request.body();
      const { email, hash, otp, newPassword } = requestBody;

      if (!email || !hash || !otp || !newPassword) {
        throw new Error("Missing required fields");
      }

      const isValidOTP = await this.verifyOTP(email, hash, otp);
      if (!isValidOTP) {
        throw new Error("invalid otp");
      }

      let admin = await Admin.query().where('email', email).first();
      if (!admin) throw new Error("admin not found");

      admin.password = newPassword;
      await admin.save();

      response.status(200).json(await formatSuccessMessage('Admin password reset successfully.', null));
    } catch (error) {
      console.error(error)
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async forgotPassword({ request, response }: HttpContextContract) {
    try {
      const email = request.input('email');

      const _schema = schema.create({
        email: schema.string({ trim: true }),
      })
      const messages = { required: 'The {{ field }} is required.' }
      await request.validate({ schema: _schema, messages });

      const user = await User.findBy('email', email);
      // console.log({ email, user })

      if (!user) {
        throw new Error('This user does not exist');
      }

      if (!jwtConstants || !jwtConstants.secret) {
        throw new Error('JWT secret is not configured');
      }

      const otp = Math.floor(100000 + Math.random() * 900000);
      const ttl = 5 * 60 * 1000; // 5 mins in ms
      // console.log(otp);

      const expires = Date.now() + ttl; // in 5 mins

      const data = `${email}.${otp}.${expires}`;
      const hash = createHmac("sha256", jwtConstants.secret).update(data).digest("hex");
      const fullHash = `${hash}.${expires}`;

      // console.log(`Generated OTP: ${otp}`);
      // console.log(`Hashed OTP: ${fullHash}`);

      // Assuming there's a method to send email
      const emailSent = await this.notificationService.sendEmail({
        to: email,
        subject: 'Reset your password',
        template: "password_reset",
        replacements: { code: otp },
      });
      if (!emailSent) {
        throw new Error('Failed to send password reset email');
      }

      response.status(200).json(await formatSuccessMessage('Password reset link sent to your email.', fullHash));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  private async verifyOTP(email: string, hash: string, otp: string): Promise<boolean> {
    if (!jwtConstants || !jwtConstants.secret) {
      throw new Error('JWT secret is not configured');
    }

    let [hashValue, expires] = hash.split(".");

    // Check if expiry time has passed
    let now = Date.now();
    if (now > parseInt(expires)) {
      throw new Error("otp expired");
    }

    // Calculate new hash with the same key and the same algorithm
    let data = `${email}.${otp}.${expires}`;
    let newCalculatedHash = createHmac("sha256", jwtConstants.secret)
      .update(data)
      .digest("hex");

    // Compare hashes
    return newCalculatedHash === hashValue;
  }

  public async resetPassword({ request, response }: HttpContextContract) {
    try {
      const requestBody = request.body();
      const { email, hash, otp, newPassword } = requestBody;

      if (!email || !hash || !otp || !newPassword) {
        throw new Error("Missing required fields");
      }

      const isValidOTP = await this.verifyOTP(email, hash, otp);
      if (!isValidOTP) {
        throw new Error("invalid otp");
      }

      let user = await User.query().where('email', email).first();
      if (!user) throw new Error("user not found");

      user.password = newPassword;
      await user.save();

      response.status(200).json(await formatSuccessMessage('Password reset successfully.', null));
    } catch (error) {
      console.error(error)
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async logout({ auth, response }: HttpContextContract) {
    try {
      await auth.use('user').revoke();
      response.status(200).json(await formatSuccessMessage("Logout successful", { revoked: true }));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async viewLoggedInUser({ response, auth }: HttpContextContract) {
    try {

      const user = auth.use('user').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      response.status(200).json(await formatSuccessMessage("User retrieved successfully", user));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async updateLoggedInUser({
    response, request, auth
  }: HttpContextContract) {
    try {
      const data = request.body();

      const user = auth.use('user').user ?? '';
      if (!user)
        throw new Error('Please login!')

      let result = await User.query()
        .where('unique_id', user.uniqueId)
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          country: data.country,
          phone: data.phone,
        })

      if (result === null) {
        throw new Error("Action failed!");
      } else {
        response.status(200).json(await formatSuccessMessage("Profile Updated.", null));
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewSingleUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN' && user.type !== 'ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result === null) {
        throw new Error("Action failed!");
      } else {
        response.status(200).json(await formatSuccessMessage("User retrieved successfully", result));
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async blockUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result[0].isBlocked === true)
        throw new Error('Account already blocked!')

      await User.query().where('unique_id', params.userId)
        .update({ is_blocked: true })

      response.status(200).json(await formatSuccessMessage("Account blocked.", null));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
  public async unblockUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result[0].isBlocked === false)
        throw new Error('Account already unblocked!')

      await User.query().where('unique_id', params.userId)
        .update({ is_blocked: false })

      response.status(200).json(await formatSuccessMessage("Account unblocked.", null));

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewAllUsers({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Not admin!')

      let data = await User.query()

      response.status(200).json(await formatSuccessMessage("Users retrieved successfully", data));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

}



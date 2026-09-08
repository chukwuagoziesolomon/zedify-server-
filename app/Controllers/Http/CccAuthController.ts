import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import { Signer, Signature } from '@ckb-ccc/core'
import { DateTime } from 'luxon'
import crypto from 'crypto'
import User from 'App/Models/User'
import UserIdentity from 'App/Models/UserIdentity'
import { formatErrorMessage, formatSuccessMessage, genRandomUuid } from 'App/helpers/utils'

const CHALLENGE_TTL_SECONDS = 5 * 60
const SUPPORTED_PROVIDER = 'ccc'

type CccPayload = {
  challengeId?: string
  provider?: string
  network?: 'mainnet' | 'testnet'
  subject?: string
  address?: string
  lockScript?: string
  publicKey?: string
  signature?: string
  signType?: string
  identity?: string
}

export default class CccAuthController {
  private configuredNetwork(): 'mainnet' | 'testnet' {
    const network = Env.get('CCC_NETWORK', Env.get('CKB_NETWORK', 'mainnet'))
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('CCC_NETWORK must be mainnet or testnet')
    }
    return network
  }

  public async challenge({ request, response }: HttpContextContract) {
    try {
      const payload = request.only(['provider', 'network', 'subject']) as CccPayload
      this.validateIdentity(payload)

      const challengeId = genRandomUuid()
      const expiresAt = DateTime.now().plus({ seconds: CHALLENGE_TTL_SECONDS })
      const message = [
        'WT Payments authentication',
        `Challenge: ${challengeId}`,
        `Provider: ${SUPPORTED_PROVIDER}`,
        `Network: ${payload.network}`,
        `Subject: ${payload.subject}`,
        `Expires: ${expiresAt.toUTC().toISO()}`,
        'Sign this message to authenticate. No transaction will be submitted.',
      ].join('\n')

      await Database.table('external_auth_challenges').insert({
        challenge_id: challengeId,
        provider: SUPPORTED_PROVIDER,
        network: payload.network,
        subject: payload.subject,
        message,
        expires_at: expiresAt.toSQL(),
        created_at: DateTime.now().toSQL(),
      })

      return response.ok(await formatSuccessMessage('Challenge created', {
        challengeId,
        message,
        expiresAt: expiresAt.toUTC().toISO(),
      }))
    } catch (error) {
      return response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async verify({ request, response, auth }: HttpContextContract) {
    try {
      const payload = request.body() as CccPayload
      const challenge = await this.consumeAndVerify(payload)
      const existingIdentity = await UserIdentity.query()
        .where('provider', SUPPORTED_PROVIDER)
        .where('network', challenge.network)
        .where('subject', challenge.subject)
        .first()

      const authenticatedUser = auth.use('user').user
      if (existingIdentity && authenticatedUser && existingIdentity.userId !== authenticatedUser.id) {
        throw new Error('This CKB identity is already linked to another account')
      }

      const user = existingIdentity
        ? await User.findOrFail(existingIdentity.userId)
        : authenticatedUser || await this.createCccUser(challenge.subject)

      await this.saveIdentity(user, challenge, payload)
      const token = await auth.use('user').generate(user, { expiresIn: '1 hour' })

      return response.ok(await formatSuccessMessage('Login successful', {
        token,
        user: this.publicUser(user),
      }))
    } catch (error) {
      return response.status(this.authErrorStatus(error)).json(await formatErrorMessage(error))
    }
  }

  public async link({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('user').user
      if (!user) throw new Error('Authentication required')

      const payload = request.body() as CccPayload
      const challenge = await this.consumeAndVerify(payload)
      const existingIdentity = await UserIdentity.query()
        .where('provider', SUPPORTED_PROVIDER)
        .where('network', challenge.network)
        .where('subject', challenge.subject)
        .first()

      if (existingIdentity && existingIdentity.userId !== user.id) {
        throw new Error('This CKB identity is already linked to another account')
      }

      await this.saveIdentity(user, challenge, payload)
      return response.ok(await formatSuccessMessage('Identity linked', {
        identity: this.identityResponse(challenge, payload),
      }))
    } catch (error) {
      return response.status(this.authErrorStatus(error)).json(await formatErrorMessage(error))
    }
  }

  public async unlink({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('user').user
      if (!user) throw new Error('Authentication required')

      const { subject } = request.only(['subject'])
      if (!subject) throw new Error('subject is required')
      if (!user.email || user.email.startsWith('ccc:')) {
        throw new Error('Add an email recovery method before unlinking your only identity')
      }

      await UserIdentity.query()
        .where('userId', user.id)
        .where('provider', SUPPORTED_PROVIDER)
        .where('network', this.configuredNetwork())
        .where('subject', subject)
        .delete()

      return response.ok(await formatSuccessMessage('Identity unlinked', { subject }))
    } catch (error) {
      return response.status(this.authErrorStatus(error)).json(await formatErrorMessage(error))
    }
  }

  private validateIdentity(payload: CccPayload) {
    if (payload.provider !== SUPPORTED_PROVIDER) throw new Error('Only CCC identities are supported')
    if (!payload.network || payload.network !== this.configuredNetwork()) throw new Error('Wallet network does not match the configured application network')
    if (!payload.subject || payload.subject.length > 4096) throw new Error('CCC canonical identity subject is required')
  }

  private async consumeAndVerify(payload: CccPayload) {
    this.validateIdentity(payload)
    if (!payload.challengeId || !payload.signature || !payload.signType || !payload.identity) {
      throw new Error('challengeId, signature, signType, and identity are required')
    }
    if (payload.identity !== payload.subject) throw new Error('CCC identity does not match the challenge subject')

    const network = payload.network as 'mainnet' | 'testnet'
    const challenge = await Database.from('external_auth_challenges')
      .where('challenge_id', payload.challengeId)
      .where('provider', SUPPORTED_PROVIDER)
      .where('network', network)
      .where('subject', payload.subject)
      .first()

    if (!challenge || challenge.used_at || DateTime.fromSQL(challenge.expires_at) <= DateTime.now()) {
      throw new Error('Challenge is invalid, expired, or already used')
    }

    const valid = await Signer.verifyMessage(challenge.message, new Signature(
      payload.signature,
      payload.identity,
      payload.signType as any,
    ))
    if (!valid) throw new Error('Invalid CCC signature')

    const updated = await Database.from('external_auth_challenges')
      .where('id', challenge.id)
      .whereNull('used_at')
      .where('expires_at', '>', DateTime.now().toSQL())
      .update({ used_at: DateTime.now().toSQL() })
    if (Number(updated) !== 1) throw new Error('Challenge has already been used')

    return challenge
  }

  private async saveIdentity(user: User, challenge: any, payload: CccPayload) {
    const values = {
      userId: user.id,
      provider: SUPPORTED_PROVIDER as 'ccc',
      network: challenge.network as 'mainnet' | 'testnet',
      subject: challenge.subject,
      lockScript: payload.lockScript || null,
      publicKey: payload.publicKey || null,
      verifiedAt: DateTime.now(),
      lastAuthenticatedAt: DateTime.now(),
    }
    const identity = await UserIdentity.query()
      .where('provider', SUPPORTED_PROVIDER)
      .where('network', challenge.network)
      .where('subject', challenge.subject)
      .first()
    if (identity) return identity.merge(values).save()
    return UserIdentity.create(values)
  }

  private async createCccUser(subject: string) {
    const suffix = crypto.createHash('sha256').update(subject).digest('hex').slice(0, 32)
    return User.create({
      email: `ccc:${suffix}@identity.local`,
      password: crypto.randomBytes(32).toString('hex'),
      isVerified: true,
    })
  }

  private identityResponse(challenge: any, payload: CccPayload) {
    return {
      provider: SUPPORTED_PROVIDER,
      network: challenge.network,
      subject: challenge.subject,
      address: payload.address || null,
      lockScript: payload.lockScript || null,
      publicKey: payload.publicKey || null,
    }
  }

  private publicUser(user: User) {
    const { password, ...safeUser } = user.toJSON()
    return safeUser
  }

  private authErrorStatus(error: any) {
    return error?.message === 'Authentication required' ? 401 : 400
  }
}
import { AuthenticationException } from '@adonisjs/auth/build/standalone'
import type { GuardsList } from '@ioc:Adonis/Addons/Auth'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000 // 7 minutes

/**
 * Auth middleware is meant to restrict un-authenticated access to a given route
 * or a group of routes.
 *
 * You must register this middleware inside `start/kernel.ts` file under the list
 * of named middleware.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to when request is Unauthorized
   */
  protected redirectTo = '/login'

  protected async authenticate(auth: HttpContextContract['auth'], guards: (keyof GuardsList)[]) {
    let guardLastAttempted: string | undefined

    for (let guard of guards) {
      guardLastAttempted = guard

      if (await auth.use(guard).check()) {
        auth.defaultGuard = guard

        // Enforce inactivity timeout for OAT (opaque token) guards
        const oatGuard = auth.use(guard) as any
        const token = oatGuard.token ?? oatGuard.tokenHash ?? null
        const rawToken: string | undefined =
          oatGuard.parsedToken?.value ?? oatGuard.tokenHash ?? null

        if (rawToken) {
          const row = await Database.from('api_tokens')
            .where('token', rawToken)
            .select('id', 'last_used_at')
            .first()

          if (row) {
            const now = Date.now()
            const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : null

            if (lastUsed !== null && now - lastUsed > INACTIVITY_TIMEOUT_MS) {
              // Revoke the token and reject the request
              await Database.from('api_tokens').where('id', row.id).delete()
              throw new AuthenticationException(
                'Unauthorized access',
                'E_UNAUTHORIZED_ACCESS',
                guardLastAttempted,
                this.redirectTo,
              )
            }

            // Refresh last_used_at on every active request
            await Database.from('api_tokens')
              .where('id', row.id)
              .update({ last_used_at: new Date().toISOString() })
          }
        }

        return true
      }
    }

    throw new AuthenticationException(
      'Unauthorized access',
      'E_UNAUTHORIZED_ACCESS',
      guardLastAttempted,
      this.redirectTo,
    )
  }

  public async handle (
    { auth }: HttpContextContract,
    next: () => Promise<void>,
    customGuards: (keyof GuardsList)[]
  ) {
    const guards = customGuards.length ? customGuards : [auth.name]
    await this.authenticate(auth, guards)
    await next()
  }
}

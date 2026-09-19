import { test } from '@japa/runner'
import User from 'App/Models/User'
import CccAuthController from 'App/Controllers/Http/CccAuthController'

test.group('CCC account linking', () => {
  test('should reuse the existing email account when CCC sign-in includes the same email', async ({ assert }) => {
    const existingUser = await User.create({
      email: 'existing-user@example.com',
      password: 'StrongPassword123!',
      isVerified: true,
      firstName: 'Existing',
      lastName: 'User',
    })

    try {
      const controller = new CccAuthController() as any
      const resolvedUser = await controller.resolveUserForCccLogin(null, { email: 'existing-user@example.com' }, null)

      assert.equal(resolvedUser.id, existingUser.id)
      assert.equal(resolvedUser.email, existingUser.email)
    } finally {
      await existingUser.delete()
    }
  })

  test('should create a provisional CCC account for a new user until onboarding is complete', async ({ assert }) => {
    const controller = new CccAuthController() as any
    const resolvedUser = await controller.resolveUserForCccLogin(null, { subject: 'ccc-subject-123' }, null)

    assert.isTrue(typeof resolvedUser.email === 'string')
    assert.equal(resolvedUser.email.startsWith('ccc:'), true)
    assert.equal(resolvedUser.email.includes('@identity.local'), true)

    await resolvedUser.delete()
  })
})

import { test } from '@japa/runner'

test.group('CORS config', () => {
  test('uses CLIENT_URL as the allowed origin when configured', async ({ assert }) => {
    process.env.CLIENT_URL = 'https://app.example.com'
    delete require.cache[require.resolve('../../config/cors')]

    const corsConfig = require('../../config/cors').default
    const request = {
      header: (name: string) => (name === 'origin' ? 'https://app.example.com' : undefined),
    }

    assert.equal(corsConfig.origin('https://app.example.com' as any), 'https://app.example.com')
    assert.equal(corsConfig.origin(request as any), 'https://app.example.com')
  })
})

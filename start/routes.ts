import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

import '../routes/admin/admin'
import '../routes/admin/currency'
import '../routes/admin/crypto_network'

import '../routes/user/user'
import '../routes/user/settings_api_key'
import '../routes/user/settings_webhook'
import '../routes/user/settings_general'
import '../routes/user/settings_payout'
import '../routes/user/currency'
import '../routes/user/payment_intent'

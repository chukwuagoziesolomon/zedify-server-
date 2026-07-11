import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

import '../routes/user/user'
import '../routes/admin/admin'
import '../routes/admin/currency'
import '../routes/admin/crypto_network'
import '../routes/user/settings_api_key'

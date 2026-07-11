import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

import '../routes/user/user'
import '../routes/admin/admin'
import '../routes/admin/currency'

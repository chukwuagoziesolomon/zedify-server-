import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

Route.get('/favicon.ico', async ({ response }) => {
  return response.status(204).send('')
})

import '../routes/admin/admin'
import '../routes/admin/currency'
import '../routes/admin/crypto_network'
import '../routes/admin/dashboard'

import '../routes/user/user'
import '../routes/user/account_info'
import '../routes/user/settings_api_key'
import '../routes/user/settings_webhook'
import '../routes/user/settings_general'
import '../routes/user/settings_payout'
import '../routes/user/currency'
import '../routes/user/payment_intent'
import '../routes/user/transfer'
import '../routes/user/payment_link'
import '../routes/user/sse'
import '../routes/user/withdrawal'
import '../routes/user/wallet'
import '../routes/user/shop_builder'
import '../routes/user/shop_products'
import '../routes/user/shop_customization'
import '../routes/user/cart'

// Webhook routes for payment confirmations
import '../routes/webhooks'
import '../routes/webhooks/payout'

// Public payment status routes (for payment widgets — no auth required)
import '../routes/payment_status'

// Public payment link checkout routes (for customer checkout — no auth required)
import '../routes/public'

// CKB test routes (temporary)
import '../routes/test/ckb'

// Fiber Network routes
import '../routes/user/fiber'

// Business Fiber Settings routes
import '../routes/business/fiber'

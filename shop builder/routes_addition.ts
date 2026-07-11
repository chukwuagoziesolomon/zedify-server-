/**
 * Add these into your existing start/routes.ts — shown separately here so
 * they don't clobber whatever routing structure/middleware groups you
 * already have for Fiber/EVM payments.
 */
import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  // --- Stablecoin savings / wallet ---
  Route.get('/currencies/stablecoins', 'WalletController.listStablecoins')
  Route.get('/wallet/balances', 'WalletController.balances').middleware('auth')
  Route.post('/wallet/deposit', 'WalletController.deposit').middleware('auth')
  Route.get('/wallet/deposits/:id', 'WalletController.depositStatus').middleware('auth')

  // --- Shop builder ---
  Route.post('/shops', 'ShopController.store').middleware('auth')
  Route.patch('/shops/:id/theme', 'ShopController.updateTheme').middleware('auth')
  Route.patch('/shops/:id/checkout-settings', 'ShopController.updateCheckoutSettings').middleware('auth')
  Route.get('/shops/:slug', 'ShopController.showBySlug') // public

  // --- Products (public read, owner write — add your own ownership check middleware) ---
  Route.get('/shops/:slug/products', 'ProductController.index') // public
  Route.post('/shops/:slug/products', 'ProductController.store').middleware('auth')
  Route.patch('/products/:id', 'ProductController.update').middleware('auth')
  Route.delete('/products/:id', 'ProductController.destroy').middleware('auth')
}).prefix('/api')

// Webhook route stays outside auth middleware and outside any CSRF group —
// Paystack calls this directly, signature verification happens inside the controller.
Route.post('/api/webhooks/paystack', 'PaystackWebhookController.handle')

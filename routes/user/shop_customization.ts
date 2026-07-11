import Route from '@ioc:Adonis/Core/Route'

/**
 * Shop AI Customization — Fiat payment unlock routes.
 * Requires user authentication.
 */
Route.group(() => {
  /** POST /api/user/shop/customization/pay — initiate a Paystack charge to unlock AI customization */
  Route.post('/pay', 'ShopCustomizationPaymentController.initiateCustomizationPayment')

  /** GET /api/user/shop/customization/status — poll unlock state + latest deposit status */
  Route.get('/status', 'ShopCustomizationPaymentController.customizationStatus')
}).prefix('/api/user/shop/customization').middleware('auth:user')

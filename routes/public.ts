import Route from '@ioc:Adonis/Core/Route'

/**
 * Public payment checkout routes — no authentication required.
 * Used by customer-facing payment widgets and checkout pages.
 */

Route.get('/api/pay/:slug', 'PaymentLinkController.publicShow')

Route.post('/api/pay/:slug/checkout', 'PaymentLinkController.checkout')

Route.post('/api/pay/:slug/wallet', 'PaymentLinkController.checkoutWallet')

Route.get('/api/storefront/:subdomain', 'ShopBuilderController.storefront')

Route.get('/api/assets/available', 'AvailableAssetController.index')

Route.get('/api/available-assets', 'AvailableAssetController.index')

/**
 * Public guest checkout — no auth required.
 */
Route.group(() => {
  Route.post('/cart/checkout', 'CartController.guestCheckout')
  Route.post('/cart/wallet', 'CartController.guestCheckoutWallet')
  Route.get('/shop/:subdomain/delivery-settings', 'ShopDeliverySettingController.publicShow')
}).prefix('/api')

import Route from '@ioc:Adonis/Core/Route'

/**
 * Public payment checkout routes — no authentication required.
 * Used by customer-facing payment widgets and checkout pages.
 */

/**
 * GET /api/pay/:slug
 * Returns payment link details + available crypto currencies for the merchant.
 * The widget uses this to render the checkout page.
 */
Route.get('/api/pay/:slug', 'PaymentLinkController.publicShow')

/**
 * POST /api/pay/:slug/checkout
 * Creates a PaymentIntent from the payment link and returns a reference_id.
 * Body: { fiat_amount?, fiat_currency? } — only required if the link has no fixed amount.
 */
Route.post('/api/pay/:slug/checkout', 'PaymentLinkController.checkout')

/**
 * POST /api/pay/:slug/wallet
 * Selects a crypto currency for the checkout session and returns a wallet address.
 * Body: { reference_id, crypto_currency_id }
 */
Route.post('/api/pay/:slug/wallet', 'PaymentLinkController.checkoutWallet')

/**
 * GET /api/storefront/:subdomain
 * Public storefront data endpoint — used by the frontend /shop/:subdomain page.
 * Returns shop info, products, theme, and checkout URL.
 */
Route.get('/api/storefront/:subdomain', 'ShopBuilderController.storefront')
Route.get('/api/assets/available', 'AvailableAssetController.index')

/**
 * GET /api/available-assets
 * Alias for /api/assets/available.
 */
Route.get('/api/available-assets', 'AvailableAssetController.index')

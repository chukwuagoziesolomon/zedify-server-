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
 * GET /api/assets/available
 * Returns all available assets (crypto + network metadata) for the frontend.
 */
Route.get('/api/assets/available', 'AvailableAssetController.index')

/**
 * GET /available-assets
 * Alias for /api/assets/available (used by frontend without /api prefix).
 */
Route.get('/available-assets', 'AvailableAssetController.index')

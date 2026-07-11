import Route from '@ioc:Adonis/Core/Route'

/**
 * Payout Webhook Routes
 * Handle settlement confirmations from payment providers
 */
Route.group(() => {
  // Paystack transfer settlement webhooks
  Route.post('/paystack', 'Http/PayoutWebhookController.handlePaystackWebhook')

  // Moniepoint transfer settlement webhooks (future)
  // Route.post('/moniepoint', 'Http/PayoutWebhookController.handleMoniepointWebhook')

  // Health check
  Route.get('/health', 'Http/PayoutWebhookController.healthCheck')
})
  .prefix('/api/webhooks/payout')
  .middleware('throttle:60,1') // Rate limit: 60 requests per minute

/**
 * Paystack fiat deposit webhook
 * Receives charge.success events for fiat→crypto deposit flows
 * (AI customization unlock payments and general stablecoin deposits).
 * No auth middleware — Paystack calls this directly.
 * Signature verification happens inside PaystackDepositWebhookController.
 */
Route.post('/api/webhooks/paystack/deposit', 'PaystackDepositWebhookController.handle')

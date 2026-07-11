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

import Route from '@ioc:Adonis/Core/Route'

/**
 * Payout Webhook Routes
 * Handle settlement confirmations from payment providers
 */
Route.group(() => {
  // Paystack transfer settlement webhooks
  Route.post('/paystack', 'PayoutWebhookController.handlePaystackWebhook')

  // Route.post('/moniepoint', 'PayoutWebhookController.handleMoniepointWebhook')

  Route.get('/health', 'PayoutWebhookController.healthCheck')
})
  .prefix('/api/webhooks/payout')
  .middleware('throttle:60,1') // Rate limit: 60 requests per minute



import Route from '@ioc:Adonis/Core/Route'

/**
 * Payment Webhook Routes
 * Handles incoming payment confirmation events from blockchain indexers
 */

// Health check - public endpoint for service monitoring
Route.get('/api/webhooks/payment/health', 'Http/PaymentWebhookController.health')

// Main webhook endpoint - receives payment events from Alchemy, Tenderly, etc.
Route.post('/api/webhooks/payment', 'Http/PaymentWebhookController.handlePaymentEvent')

// Manual polling trigger - can be called from a cron job or scheduler
Route.post('/api/webhooks/payment/poll', 'Http/PaymentWebhookController.pollPayments')

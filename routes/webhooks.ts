import Route from '@ioc:Adonis/Core/Route'

/**
 * Payment Webhook Routes
 * Handles incoming payment confirmation events from blockchain indexers
 */

// Health check - public endpoint for service monitoring
Route.get('/api/webhooks/payment/health', 'PaymentWebhookController.health')

Route.post('/api/webhooks/payment', 'PaymentWebhookController.handlePaymentEvent')

Route.post('/api/webhooks/payment/poll', 'PaymentWebhookController.pollPayments')

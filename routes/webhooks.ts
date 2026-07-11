import Route from '@ioc:Adonis/Core/Route'
import PaymentWebhookController from 'App/Controllers/Http/PaymentWebhookController'

/**
 * Payment Webhook Routes
 * Handles incoming payment confirmation events from blockchain indexers
 */

// Health check - public endpoint for service monitoring
Route.get('/api/webhooks/payment/health', [PaymentWebhookController, 'health'])

// Main webhook endpoint - receives payment events from Alchemy, Tenderly, etc.
Route.post('/api/webhooks/payment', [PaymentWebhookController, 'handlePaymentEvent'])

// Manual polling trigger - can be called from a cron job or scheduler
Route.post('/api/webhooks/payment/poll', [PaymentWebhookController, 'pollPayments'])

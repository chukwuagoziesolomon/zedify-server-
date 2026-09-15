import Route from '@ioc:Adonis/Core/Route'

/** Paystack inbound charge events (card, bank transfer, USSD, and other channels). */
Route.post('/api/webhooks/paystack/deposit', 'PaystackDepositWebhookController.handle')

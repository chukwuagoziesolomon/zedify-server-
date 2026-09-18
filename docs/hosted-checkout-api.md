# Hosted Checkout API

External platforms can create a hosted payment session and redirect their customer to the returned URL.

## Create a session

```http
POST /api/v1/checkout/sessions
Authorization: Bearer sk_test_...
Content-Type: application/json
```

```json
{
  "amount": 15000,
  "currency": "NGN",
  "reference_id": "merchant-order-123",
  "customer_email": "customer@example.com",
  "metadata": {
    "order_id": "123"
  }
}
```

The response contains a hosted checkout URL:

```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 201,
  "result": {
    "session_id": "payment-intent-uuid",
    "payment_intent_id": "payment-intent-uuid",
    "reference_id": "merchant-order-123",
    "checkout_url": "https://frontend.example.com/checkout/confirm/merchant-order-123",
    "status": "payment_created",
    "amount": 15000,
    "currency": "NGN"
  }
}
```

Redirect the customer to `checkout_url`. The hosted page handles payment-method selection. For crypto, it requests a wallet for the selected asset and the indexer confirms the transaction. For Paystack, Paystack confirms through the configured backend webhook.

## Webhook

After confirmed payment, the configured merchant webhook receives:

```http
POST <configured-webhook-url>
X-WT-Event: payment.confirmed
X-WT-Signature: sha256=<hmac-sha256>
X-WT-Timestamp: <iso-timestamp>
```

The signed JSON payload includes `businessReferenceId`, `amount`, `currency`, `transactionHash`, and `confirmedAt`. Verify the signature using the webhook signing secret configured for the merchant, and make webhook handling idempotent using the reference ID.

Until confirmation, the payment remains `payment_created` or `awaiting_confirmation`. Only `payment_completed` should be treated as paid. A session that has not produced a confirmation webhook must remain pending.

The backend must have `CLIENT_URL` configured to the hosted frontend origin.
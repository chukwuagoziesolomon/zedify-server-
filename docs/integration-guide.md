# WT Payments — Integration Guide

Use this guide when you have your **WT Payments API keys** and want to accept crypto payments on your platform.

---

## 1. What You Need

- A **WT Payments merchant account**
- A generated API key pair:
  - `public_key` — `pk_test_...` or `pk_live_...`
  - `private_key` — `sk_test_...` or `sk_live_...` (shown once only)
- Your WT Payments base URL (e.g. `https://payments.yourdomain.com`)

---

## 2. Authentication

All merchant endpoints require:

```
Authorization: Bearer <public_key>
```

Use the **public key** as the Bearer token. The private key is for key generation only — store it securely in your `.env`.

```bash
curl https://payments.yourdomain.com/api/user/account-info \
  -H "Authorization: Bearer pk_test_abc123..."
```

---

## 3. Verify Your API Key

```bash
POST /api/user/settings/api-key/verify
Content-Type: application/json

{ "secret_key": "sk_test_abc123..." }
```

**Response `200`:**

```json
{
  "error": false,
  "result": {
    "environment": "TEST",
    "business_id": "d0f9ba1e-..."
  }
}
```

**Response `401`:**

```json
{ "error": true, "data": "Invalid or expired key." }
```

> TEST keys expire after **2 hours**. Generate a new one via `POST /api/user/settings/api-key` when needed.

---

## 4. Accept a Payment

### Step 1 — Create a Payment Link

A payment link represents a chargeable item or invoice.

```bash
POST /api/client/payment-links
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{
  "title": "Premium Plan",
  "description": "Monthly subscription",
  "fiat_currency": "NGN",
  "fiat_amount": 15000
}
```

**Response:**

```json
{
  "error": false,
  "message": "Payment link created",
  "result": {
    "link": {
      "id": "uuid",
      "slug": "abc123-slug",
      "title": "Premium Plan",
      "status": "active",
      "checkout_url": "/api/pay/abc123-slug"
    },
    "checkout_url": "/api/pay/abc123-slug"
  }
}
```

Save the `slug`.

---

### Step 2 — Customer Checkout (Public)

The customer opens the checkout URL on your platform or redirects them to:

```
GET /api/pay/{slug}
```

This returns the available crypto assets and converted amounts.

**Response:**

```json
{
  "error": false,
  "data": {
    "slug": "abc123-slug",
    "title": "Premium Plan",
    "fiat_amount": 15000,
    "fiat_currency": { "symbol": "NGN", "name": "Nigerian Naira" },
    "is_fixed_amount": true,
    "assets": [
      {
        "currency_id": "usdt-bsc-uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "BSC", "logo": "https://..." },
        "amount": 20.41
      }
    ]
  }
}
```

Show the customer the expected crypto `amount` for their chosen asset.

---

### Step 3 — Create a Payment Session and Get a Wallet

When the customer selects an asset, create a payment intent and get a deposit address.

```bash
POST /api/pay/{slug}/checkout
Content-Type: application/json

{ "reference_id": "my-order-123" }
```

**Response:**

```json
{
  "error": false,
  "message": "Checkout session created",
  "result": {
    "payment_intent_id": "uuid",
    "reference_id": "my-order-123",
    "fiat_amount": 15000,
    "fiat_currency": "NGN"
  }
}
```

Then get the wallet:

```bash
POST /api/pay/{slug}/wallet
Content-Type: application/json

{
  "reference_id": "my-order-123",
  "crypto_currency_id": "usdt-bsc-uuid"
}
```

**Response:**

```json
{
  "error": false,
  "data": {
    "reference_id": "my-order-123",
    "payment_intent_id": "uuid",
    "expiration_time": 1800,
    "wallet": {
      "address": "0xAbC123...",
      "network": "BSC",
      "currency": "USDT"
    },
    "fiat": { "amount": 15000, "currency": "NGN" },
    "crypto": { "amount": 20.41, "currency": "USDT" }
  }
}
```

Show `wallet.address` to the customer. The wallet expires after **30 minutes**.

---

### Step 4 — Track Payment Status

Poll the public status endpoint:

```bash
GET /api/payment/status/{reference_id}
```

**Response:**

```json
{
  "error": false,
  "data": {
    "status": "payment_created",
    "wallet": "0xAbC123...",
    "crypto": { "amount": 20.41, "currency": "USDT" },
    "fiat_amount": 15000,
    "fiat_currency": "NGN"
  }
}
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `payment_created` | Waiting for payment |
| `incomplete_payment` | Detected, but amount mismatch |
| `awaiting_confirmation` | Received, awaiting confirmations |
| `payment_completed` | Fully confirmed |

---

### Step 5 — Receive Push Updates (SSE)

Instead of polling, open a server-sent events stream.

```js
const token = 'pk_test_abc123...'

const es = new EventSource(
  `https://payments.yourdomain.com/api/payment/status/${reference_id}/stream`,
  { headers: { Authorization: `Bearer ${token}` } }
)

es.addEventListener('status', (e) => {
  const data = JSON.parse(e.data)
  if (data.status === 'payment_completed') {
    // Fulfill the order
    es.close()
  }
})

es.addEventListener('timeout', () => {
  es.close()
  // Handle expired payment window
})

es.onerror = () => {
  setTimeout(() => location.reload(), 3000)
}
```

| Event | When |
|-------|------|
| `status` | Payment status changed |
| `heartbeat` | Keepalive every ~4s |
| `complete` | Terminal success/failure |
| `timeout` | Session expired |
| `error` | Something failed |

---

## 5. Withdraw Funds

### Get a Quote

```bash
GET /api/user/withdrawal/quote?amount=100&type=fiat
Authorization: Bearer pk_test_abc123...
```

**Response:**

```json
{
  "error": false,
  "result": {
    "amount": 100,
    "transactionFee": 5,
    "estimatedNetworkFee": 0.5,
    "amountToReceive": 94.5,
    "asset": "USDT",
    "estimatedArrivalMinutes": 5,
    "exchangeRate": 1560,
    "nairaAmountToReceive": 147420,
    "fiatCurrency": "NGN"
  }
}
```

### Initiate Withdrawal (Fiat)

Bank details come from your saved payout settings. No bank fields needed here.

```bash
POST /api/user/withdrawal/initiate
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{
  "type": "fiat",
  "user_wallet_id": "wallet-uuid",
  "amount": 100
}
```

**Response:**

```json
{
  "error": false,
  "result": {
    "otp_id": "otp-uuid",
    "fees": { "transactionFee": 5, "estimatedNetworkFee": 0.5 }
  }
}
```

An OTP is sent to your registered email.

### Confirm Withdrawal

```bash
POST /api/user/withdrawal/confirm
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{
  "otp_id": "otp-uuid",
  "otp_code": "123456"
}
```

**Response:**

```json
{
  "error": false,
  "result": {
    "status": "completed",
    "tx_hash": "0xabc..."
  }
}
```

### Initiate Withdrawal (Crypto)

```bash
POST /api/user/withdrawal/initiate
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{
  "type": "crypto",
  "user_wallet_id": "wallet-uuid",
  "amount": 50,
  "crypto_currency_id": "currency-uuid",
  "network_id": "network-uuid",
  "recipient_address": "0xAbC123..."
}
```

---

## 6. Webhooks (Server-Side Notifications)

Configure a webhook URL to receive payment events on your server.

### Save Webhook URL

```bash
POST /api/user/settings/webhook
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{
  "url": "https://your-platform.com/wt-payments/webhook",
  "environment": "TEST"
}
```

> URL must be `https://`.

### Generate Signing Secret

```bash
POST /api/user/settings/webhook/secret/generate
Authorization: Bearer pk_test_abc123...
```

Store the returned `signing_secret` as `WT_WEBHOOK_SECRET`.

### Verify Signature

```python
import hashlib, hmac

def verify_signature(secret, signature, raw_body):
    expected = hmac.new(secret.encode(), raw_body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### Webhook Payload

```json
{
  "event": "payment.confirmed",
  "data": {
    "reference_id": "my-order-123",
    "payment_intent_id": "uuid",
    "amount": 15000,
    "currency": "NGN",
    "crypto_amount": 20.41,
    "crypto_currency": "USDT",
    "network": "BSC",
    "tx_hash": "0xabc123...",
    "wallet_address": "0xAbC123...",
    "confirmed_at": "2026-08-25T14:00:00.000Z"
  }
}
```

**Event types:**

| Event | When |
|-------|------|
| `payment.confirmed` | Payment received on-chain |
| `payment.completed` | Payment fully settled |
| `payment.failed` | Payment expired or failed |

### Test Connectivity

```bash
POST /api/user/settings/webhook/verify
Authorization: Bearer pk_test_abc123...
Content-Type: application/json

{ "environment": "TEST" }
```

---

## 7. Error Handling

```json
{ "error": true, "data": "Human-readable message", "code": 400 }
```

| Code | Meaning |
|------|---------|
| `400` | Bad request / business logic error |
| `401` | Unauthenticated or token expired |
| `422` | Validation failure |
| `404` | Resource not found |
| `500` | Server error |

---

## 8. Complete Integration Example (Node.js)

```js
const axios = require('axios')

const API_BASE = 'https://payments.yourdomain.com'
const API_KEY = process.env.WT_PUBLIC_KEY

const api = axios.create({
  baseURL: API_BASE,
  headers: { Authorization: `Bearer ${API_KEY}` },
})

async function createPaymentLink() {
  const { data } = await api.post('/api/client/payment-links', {
    title: 'Premium Plan',
    fiat_currency: 'NGN',
    fiat_amount: 15000,
  })
  return data.result.link.slug
}

async function startCheckout(slug, referenceId) {
  await api.post(`/api/pay/${slug}/checkout`, { reference_id: referenceId })
  const { data } = await api.post(`/api/pay/${slug}/wallet`, {
    reference_id: referenceId,
    crypto_currency_id: 'usdt-bsc-uuid',
  })
  return data.data.wallet.address
}

async function waitForPayment(referenceId) {
  return new Promise((resolve) => {
    const es = new EventSource(
      `${API_BASE}/api/payment/status/${referenceId}/stream`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    )
    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      if (data.status === 'payment_completed') {
        es.close()
        resolve(data)
      }
    })
    es.addEventListener('timeout', () => {
      es.close()
      resolve(null)
    })
  })
}

async function processOrder(order) {
  const slug = await createPaymentLink()
  const wallet = await startCheckout(slug, order.id)
  // Show wallet.address to customer
  const result = await waitForPayment(order.id)
  if (result) {
    // Payment confirmed — fulfill the order
  }
}
```

---

## 9. Notes

- The **Shop Builder** is used directly on the WT Payments platform — it is not exposed via API for embedding.
- **TEST mode** keys expire after 2 hours. Generate new ones as needed.
- **LIVE mode** keys require account verification.
- Always use `reference_id` to match payment events to your internal orders.
- Webhook endpoints must be `https://`.

---

## 10. Support

- Base URL: `https://payments.yourdomain.com`
- Full API reference: `docs/frontend-integration-guide.md`
- Payment indexer: `docs/payment-indexer-setup.md`
- SSE reference: `docs/sse-integration.md`

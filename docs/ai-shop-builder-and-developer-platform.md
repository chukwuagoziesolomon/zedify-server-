# AI Shop Builder & Developer Platform
## How WT Payments Grows the CKB Nervos Blockchain Ecosystem

---

## Overview

We have built two major features that work together to drive real-world crypto payment adoption — specifically for the **CKB (Nervos) blockchain**:

1. **AI Shop Builder** — lets any merchant create a fully functional e-commerce store in minutes using an AI agent, with payments powered by WT Payments (which supports CKB natively).
2. **Developer Platform (API Keys + Webhooks)** — gives developers and businesses the tools to integrate WT Payments into their own applications, adding CKB as an accepted payment method wherever they build.

The core idea: **more stores + more developer integrations = more CKB transactions on-chain.**

---

## Feature 1: AI Shop Builder

### What It Is

The AI Shop Builder lets merchants create a branded e-commerce website — hosted on our domain (`{businessname}.yourdomain.com`) — without writing a single line of code. An AI agent guides them through the entire setup process conversationally and remembers everything about their shop across sessions.

### How It Works

**Step 1 — Create a shop**
```
POST /user/shop
{ "business_name": "Adaeze Fabrics", "subdomain": "adaeze-fabrics", "currency": "NGN" }
```
This creates a shop at `https://adaeze-fabrics.yourdomain.com`.

**Step 2 — Talk to the AI agent**
```
POST /user/shop/ai/chat
{ "message": "Help me design a colorful Ankara fashion store with a hero section and a grid layout" }
```
The AI responds with a theme config JSON that is automatically applied to the shop:
```json
{
  "action": "update_theme",
  "theme_config": {
    "primaryColor": "#E84C3D",
    "fontFamily": "Poppins",
    "layout": "grid",
    "heroText": "Authentic Ankara Fashion",
    "heroSubtext": "Shop the finest fabrics delivered to your door"
  }
}
```

**Step 3 — Add products**
```
POST /user/shop/products
{
  "name": "Premium Ankara Fabric - 6 yards",
  "price": 15000,
  "description": "100% cotton, vibrant traditional patterns",
  "category": "Fabrics",
  "stock": 50,
  "track_stock": true
}
```

**Step 4 — Upload product images**
```
POST /user/shop/products/:id/images
multipart: images[] (up to 5 images per product)
```

**Step 5 — Publish**
```
PUT /user/shop
{ "status": "published" }
```

The shop is now live. Every checkout on that shop goes through WT Payments — supporting fiat and **CKB** as payment options.

### AI Agent Memory Architecture

The AI agent uses **persistent multi-turn memory**. Every conversation is stored in the `ai_shop_conversations` table with full message history. This means:

- The agent remembers what you discussed last week
- It knows your current products and prices without you repeating them
- It picks up the conversation context seamlessly in new sessions
- The system prompt is dynamically rebuilt on every request with live shop + product data

**Primary model:** `gemini-2.0-flash` (via Google Gemini)

The model is configured via `GEMINI_MODEL` and `GEMINI_API_KEY`.

### AI Endpoints Summary

| Endpoint | Description |
|---|---|
| `POST /user/shop/ai/chat` | Send message to agent — auto-applies theme changes |
| `GET /user/shop/ai/history` | Full conversation history (clean, no reasoning internals) |
| `DELETE /user/shop/ai/memory` | Reset memory — start a fresh design session |

---

## Feature 2: Developer Platform (API Keys + Webhooks)

### What It Is

The Developer Platform lets any business or developer integrate WT Payments into their own applications using standard API keys and webhook events. This is how WT Payments becomes infrastructure — embedded into thousands of third-party apps — each one adding CKB as a supported payment method.

### API Keys

Every merchant gets two key pairs: one for **TEST** mode and one for **LIVE** mode.

| Key | Format | Use |
|---|---|---|
| Secret key (private) | `sk_live_<40 hex chars>` | Server-side API calls — never expose publicly |
| Public key | `pk_live_<40 hex chars>` | Client-side initialization of payment widgets |

**Generate keys:**
```
POST /api/user/settings/api-key
```
Returns `{ private_key, public_key }` — **private key shown once**, then hashed in the DB.

**Switch environments** (in General Settings):
```
POST /api/user/settings/general
{ "current_environment": "LIVE" }
```
The next key generation will produce `sk_live_` / `pk_live_` keys.

**Verify a key (for developers):**
```
POST /api/user/settings/api-key/verify
{ "secret_key": "sk_test_abc123..." }
```
No dashboard login required — developers can test their integration from the terminal.

### Webhooks

Webhooks are how WT Payments communicates events back to a developer's server in real time. When a payment is confirmed on-chain (including CKB transactions), the developer's server is notified immediately.

#### Setup Flow

**1. Save your webhook URL:**
```
POST /api/user/settings/webhook
{ "url": "https://myapp.com/wt-payments/webhook", "environment": "LIVE" }
```
Only HTTPS URLs are accepted.

**2. Generate your signing secret:**
```
POST /api/user/settings/webhook/secret/generate
```
Returns `{ signing_secret: "abc123..." }` — **shown once**. Used to verify incoming webhooks.

**3. Test your endpoint:**
```
POST /api/user/settings/webhook/verify
{ "environment": "LIVE" }
```
Sends a test `payment.confirmed` event to your URL and reports back `{ reachable, status_code }`.

**4. Monitor delivery logs:**
```
GET /api/user/settings/webhook/logs?success=false&limit=20
```
See every delivery attempt, HTTP response code, and error message.

#### Webhook Events

| Event | When it fires |
|---|---|
| `payment.confirmed` | A crypto payment is confirmed on-chain (EVM or CKB) |
| `payment.failed` | A payment attempt failed or expired |
| `payment.pending` | A payment has been created and is awaiting confirmation |
| `payout.completed` | A fiat or crypto payout was successfully sent |
| `payout.failed` | A payout attempt failed |

#### Webhook Payload Structure

Every POST to your URL looks like this:
```json
{
  "event": "payment.confirmed",
  "environment": "LIVE",
  "timestamp": "2026-06-13T10:45:00.000Z",
  "data": {
    "paymentId": "d0f9ba1e-...",
    "businessReferenceId": "order_12345",
    "amount": 50000,
    "currency": "NGN",
    "transactionHash": "0xabc123...",
    "confirmedAt": "2026-06-13T10:44:58.000Z"
  }
}
```

#### Security — Signature Verification

Every webhook is signed with **HMAC-SHA256** using the merchant's unique signing secret.
The signature is in the `X-WT-Signature` header in the format `sha256=<hex>`.

**Verify in Node.js:**
```js
const crypto = require('crypto')

function verifyWebhookSignature(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  // Constant-time comparison — prevents timing attacks
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// Express example
app.post('/wt-payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-wt-signature']
  const isValid = verifyWebhookSignature(req.body, sig, process.env.WT_WEBHOOK_SECRET)
  if (!isValid) return res.status(401).send('Invalid signature')

  const { event, data } = JSON.parse(req.body)

  if (event === 'payment.confirmed') {
    // Fulfill the order
    fulfillOrder(data.businessReferenceId)
  }

  res.status(200).send('OK')
})
```

**Verify in Python:**
```python
import hmac, hashlib

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

**Retry policy:** 3 attempts with exponential back-off (1s → 2s → 4s). If all fail, the log is marked failed and visible in the dashboard.

---

## How These Features Grow the CKB Nervos Ecosystem

### The Problem CKB Faces
CKB is a technically strong Layer 1 blockchain but has limited real-world merchant adoption. Most merchants don't accept CKB because:
- There is no easy checkout experience for it
- Developers don't have a simple integration path
- There are no ready-made e-commerce tools built around it

### How We Solve It

**AI Shop Builder → Direct CKB Merchant Adoption**

Every shop created through our AI builder accepts payments via WT Payments. WT Payments has CKB integrated at the infrastructure level (`CKBService`, wallet generation, balance polling). This means:

- A fashion merchant in Lagos who has never heard of CKB can now accept CKB payments on their AI-built store
- Their customers who hold CKB can spend it at real stores for real goods
- Every completed checkout creates an on-chain CKB transaction
- The more shops built → the more CKB payment volume

This is a **bottom-up adoption strategy** — merchants don't choose CKB, they get it automatically by using our platform.

**Developer Platform → CKB Embedded in Third-Party Apps**

The API key + webhook system turns WT Payments into programmable infrastructure. Any developer can now:

1. Add WT Payments to their existing app using the secret key
2. Listen for `payment.confirmed` webhooks to trigger order fulfillment
3. Their users pay in CKB without the developer needing to understand blockchain

This is a **network effects strategy** — every developer integration multiplies the number of places where CKB can be spent. A single developer building a popular marketplace brings CKB to all of their users.

**Combined flywheel:**
```
More shops built via AI → More places to spend CKB
         ↓
More developers integrate webhooks → More apps accept CKB
         ↓
More CKB transactions on-chain → More ecosystem activity
         ↓
More visibility for CKB → More users and merchants
         ↓
More shops built via AI → (repeat)
```

### CKB-Specific Technical Integration

The CKB integration in this codebase (`app/Services/CKBService.ts`) uses `@ckb-lumos/lumos` and provides:

- **Wallet generation** — `hd.key` for deterministic key derivation, SECP256K1_BLAKE160 lock scripts
- **Address generation** — testnet (AGGRON4) and mainnet compatible
- **Balance queries** — via CKB Indexer (cell collector)
- **Transaction lookup** — via CKB RPC
- **Block queries** — chain tip and block-by-number

The network RPC URL is loaded dynamically from the `crypto_networks` DB table (`chainKey = 'ckb'`), so switching from testnet to mainnet requires only a database update — no code change.

---

## Environment Variables Required

```env
# AI Shop Builder
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash
SHOP_BASE_DOMAIN=yourdomain.com

# Webhooks
WEBHOOK_SECRET=global-fallback-secret   # used if merchant has no per-merchant secret yet
APP_ENV=production                       # controls LIVE vs TEST webhook URL selection
```

---

## Database Tables Added

| Table | Purpose |
|---|---|
| `shops` | Merchant shop config, subdomain, theme, status |
| `shop_products` | Product catalog with images, variants, stock |
| `ai_shop_conversations` | Full AI conversation history per shop |
| `webhook_logs` | Every webhook delivery attempt, response, and retry |
| `business_settings.webhook_signing_secret` | Per-merchant HMAC secret (new column) |

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

**Primary model:** `claude-haiku-4-5-20251001` (via Anthropic Messages API)

The model is configured via `ANTHROPIC_MODEL` and `ANTHROPIC_API_KEY`.

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
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
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

---

## Fiber Network (CKB Payment Channels)

Fiber integration lets merchants **receive and send CKB payments** through payment channels instead of waiting for on-chain transactions every time.

### How it works

- The server creates a **Fiber invoice** for each checkout session when a customer selects a Fiber network asset.
- The customer pays the invoice through the Fiber Network.
- The server polls for payment status and, once paid, marks the payment intent as confirmed.
- Webhooks, SSE events, and email notifications fire the same way as EVM/CKB payments.

### FNN setup (testnet / mainnet)

Current Fiber releases ship three binaries: `fnn` (node), `fnn-cli`, and `fnn-migrate`.

1. Download the release from [github.com/nervosnetwork/fiber/releases](https://github.com/nervosnetwork/fiber/releases) and place `fnn` + `fnn-cli` on the VPS that will run the node.
2. Copy the release `config/testnet/config.yml` (or `config/mainnet/config.yml`) into that same working directory.
3. Prepare a CKB key for the node wallet (via `ckb-cli`) and place the exported key where FNN expects it.
4. In `config.yml`, verify the RPC block uses `rpc.listening_addr` for the bind address, for example:
   ```yaml
   rpc:
     listening_addr: 127.0.0.1:8227
     enabled_modules:
       - node
       - channel
       - payment
       - invoice
   ```
   Keep the node bound to `127.0.0.1:8227`, not a public interface. If you need HTTPS exposure, put a reverse proxy in front of it on the VPS; do not bind FNN publicly.
5. Start FNN:
   ```bash
   FIBER_SECRET_KEY_PASSWORD='your-strong-password' RUST_LOG=info ./fnn -c config.yml -d .
   ```
   The password encrypts the wallet key file; the node will not start without it.
6. Verify from the same VPS:
   ```bash
   ./fnn-cli info
   ```
   FNN also accepts JSON-RPC POSTs on that port, e.g.:
   ```bash
   curl -X POST http://127.0.0.1:8227 \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'
   ```

### Exposing FNN to Render

FNN’s JSON-RPC endpoint is plain HTTP only. If Render needs to talk to it over the public internet, terminate TLS at a reverse proxy on the VPS instead of making FNN bind publicly.

Example with Caddy:

```text
your-fnn-host.example.com {
  reverse_proxy 127.0.0.1:8227
}
```

With that setup:
- FNN stays on `127.0.0.1:8227`
- Caddy listens on `443` and forwards to FNN
- This server’s `FIBER_NODE_URL` should point at the proxy, not FNN directly

```env
FIBER_NODE_URL=https://your-fnn-host.example.com
FIBER_NETWORK=mainnet
FIBER_BISCUIT_TOKEN=
```

If you skip the reverse proxy and expose FNN directly, that is discouraged. If you must, enable Biscuit auth in `config.yml` and generate a token with `biscuit-cli`, but treat that as a fallback, not the recommended architecture.

### Biscuit tokens

Biscuit tokens are capability tokens minted from your own FNN host. They are **not** fetched from an API. The flow is:

1. Install `biscuit-cli` and generate an Ed25519 keypair:
   ```bash
   cargo install biscuit-cli --vers 0.6.0-beta.2
   biscuit keypair
   # → Private key: ed25519-private/...
   # → Public key:  ed25519/...
   ```
2. Put the **public key** in your node's `config.yml` under `rpc.biscuit_public_key`.
3. Write a permissions file, for example:
   ```
   read("node");
   read("channels");
   write("payments");
   write("invoices");
   check if time($time), $time <= 2026-12-31T00:00:00Z;
   ```
4. Sign a token:
   ```bash
   biscuit generate --private-key ed25519-private/... permissions.bc
   ```
5. Use the resulting Base64 string as `FIBER_BISCUIT_TOKEN` in this server's `.env`, sent as `Authorization: Bearer <token>`.

Permissions are `read("<resource>")` / `write("<resource>")` per module (`node`, `channels`, `payments`, `invoices`, `graph`, `peers`, `cch`, `watchtower`, `pprof`). `write` does not imply `read`, so scope each token to only what the client needs.

- **Local (`127.0.0.1`) or behind Caddy:** leave `FIBER_BISCUIT_TOKEN` empty.
- **Direct public bind:** FNN docs explicitly discourage exposing the RPC port directly. If you do, you must set `rpc.biscuit_public_key`; Biscuit is one auth layer, not a substitute for network restriction.

### Production checklist

- VPS firewall should allow Caddy/443 inbound and outbound to wherever Render egress comes from.
- Do not hardcode Render egress source IPs without verifying Render’s current docs; outbound IPs can vary by plan/region.
- Run `node ace migration:run` after deploy so `payment_channels` and `fiber_invoices` exist.
- Confirm `GET /api/user/fiber/node-info` returns the node’s real peer ID before wiring live checkout.

### New Fiber endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/user/fiber/node-info` | FNN peer info |
| `GET` | `/api/user/fiber/channels` | List channels |
| `POST` | `/api/user/fiber/channels/open` | Open a channel |
| `POST` | `/api/user/fiber/invoices` | Create a Fiber invoice |
| `GET` | `/api/user/fiber/invoices/:address/check` | Check invoice/payment status |
| `POST` | `/api/user/fiber/invoices/sync` | Sync all pending invoices |
| `POST` | `/api/user/fiber/send` | Send a payment |
| `GET` | `/api/user/fiber/payments/:hash` | Get payment status |
| `GET` | `/api/user/fiber/invoices/:hash` | Get invoice details |
| `POST` | `/api/user/fiber/channels/sync` | Sync channel balances/states |

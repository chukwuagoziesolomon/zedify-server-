# WT Payments — Frontend Integration Guide

**Base URL:** `http://127.0.0.1:3335`
**Auth:** Bearer token in `Authorization` header on all protected routes.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Account Info](#2-account-info)
3. [Settings — API Keys](#3-settings--api-keys)
4. [Settings — Webhooks](#4-settings--webhooks)
5. [Settings — Payout (Bank Account)](#5-settings--payout-bank-account)
6. [Settings — General](#6-settings--general)
7. [AI Shop Builder](#7-ai-shop-builder)
8. [Shop Products](#8-shop-products)
9. [Payment Intents](#9-payment-intents)
10. [Withdrawals](#10-withdrawals)
11. [Dashboard Stats](#11-dashboard-stats)
12. [Available Assets](#12-available-assets)
13. [Error Handling](#13-error-handling)
14. [Axios Setup (Recommended)](#14-axios-setup-recommended)

---

## 1. Authentication

### Sign Up
**`POST /api/user/account/signup`** — `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `email` | string | ✅ |
| `password` | string | ✅ |
| `password_confirmation` | string | ✅ |
| `phone` | string | ✅ |
| `business_name` | string | ✅ |
| `business_type` | `starter` \| `registered` | ✅ |
| `bvn` | string (11 digits) | ✅ |
| `cac_number` | string | Only if `registered` |
| `cac_documents` | File[] | Only if `registered` |
| `shareholders_approval_letter` | File | Only if `registered` |

**Response `200`:**
```json
{ "error": false, "data": "User created!", "result": { "uniqueId": "...", "email": "..." } }
```

---

### Login
**`POST /api/user/account/login`** — `application/json`

```json
{ "email": "user@example.com", "password": "yourpassword" }
```

**Response `200`:**
```json
{
  "error": false,
  "data": "Login successful",
  "result": {
    "type": "bearer",
    "token": "YOUR_TOKEN_HERE",
    "expires_at": "2026-06-13T11:00:00.000Z"
  }
}
```

> Store `result.token` and attach it to every subsequent request as:
> `Authorization: Bearer YOUR_TOKEN_HERE`

**Session timeout:** Token auto-expires after **7 minutes of inactivity**. On any `401` response, clear the token and redirect to `/login`.

---

## 2. Account Info

### Get account info
**`GET /api/user/account-info`** 🔒

**Response:**
```json
{
  "result": {
    "surname": "Eze",
    "full_name": "Chukwubinyerem Emmanuella",
    "email": "ezeemmanuella710@gmail.com",
    "phone": "9096879086",
    "business_name": "My Business",
    "business_type": "starter",
    "profile_image": "https://res.cloudinary.com/..."
  }
}
```

---

### Update account info
**`PUT /api/user/account-info`** 🔒 — `application/json`

```json
{
  "surname": "Eze",
  "full_name": "Chukwubinyerem Emmanuella",
  "phone": "9096879086"
}
```
All fields optional. Only send what changed.

---

### Upload profile image
**`POST /api/user/account-info/profile-image`** 🔒 — `multipart/form-data`

| Field | Type | Constraint |
|---|---|---|
| `profile_image` | File | jpg/jpeg/png/webp, max 5MB |

**Response:**
```json
{ "result": { "profile_image": "https://res.cloudinary.com/..." } }
```

---

## 3. Settings — API Keys

### Get current public key
**`GET /api/user/settings/api-key`** 🔒

```json
{
  "result": {
    "private_key": null,
    "public_key": "pk_test_abc123...",
    "expires_at": "2026-06-14T18:00:00.000Z",
    "environment": "TEST"
  }
}
```
> `private_key` is always `null` after initial generation — it is only returned once.
> `expires_at` is `null` for LIVE keys (no expiry). For TEST keys it reflects the 2-hour expiry.
> If the TEST key has expired, `public_key` is returned as `null`.

If the user is on the LIVE environment but **not yet verified**, the response is `403 Forbidden`:
```json
{ "result": { "public_key": null, "private_key": null, "expires_at": null, "requires_verification": true } }
```

---

### Generate new key pair
**`POST /api/user/settings/api-key`** 🔒

No body required. Uses the current environment (`TEST` or `LIVE`).

**TEST response:**
```json
{
  "result": {
    "private_key": "sk_test_abc123...",
    "public_key": "pk_test_xyz456...",
    "expires_at": "2026-06-14T18:00:00.000Z",
    "environment": "TEST"
  }
}
```

**LIVE response** (verified users only):
```json
{
  "result": {
    "private_key": "sk_live_abc123...",
    "public_key": "pk_live_xyz456...",
    "expires_at": null,
    "environment": "LIVE"
  }
}
```

> ⚠ Show `private_key` to the user **immediately and once**. It cannot be retrieved again.
> TEST keys expire after **2 hours**. Generate a new one when `expires_at` is past or `public_key` is null.
> LIVE key generation returns `403` if the user account is not verified. Show a prompt to complete verification first.

---

### Verify a secret key (developer tool)
**`POST /api/user/settings/api-key/verify`** — No auth required

```json
{ "secret_key": "sk_test_abc123..." }
```

**Response `200`:**
```json
{ "result": { "environment": "TEST", "business_id": "d0f9ba1e-..." } }
```

**Response `401`:** `{ "data": "Invalid or expired key." }`

---

## 4. Settings — Webhooks

### Get webhook config
**`GET /api/user/settings/webhook`** 🔒

```json
{
  "result": {
    "live": { "url": "https://myapp.com/webhook" },
    "test": { "url": null },
    "has_signing_secret": true
  }
}
```

---

### Save a webhook URL
**`POST /api/user/settings/webhook`** 🔒

```json
{
  "url": "https://myapp.com/wt-payments/webhook",
  "environment": "LIVE"
}
```
> URL must be `https://`. HTTP URLs are rejected.

---

### Generate / rotate signing secret
**`POST /api/user/settings/webhook/secret/generate`** 🔒

No body required.

**Response:**
```json
{
  "data": "Signing secret generated. Store this securely — it will not be shown again.",
  "result": { "signing_secret": "a3f8b2c1d4e5..." }
}
```
> ⚠ Show to user **once only**. Store it in their `.env` as `WT_WEBHOOK_SECRET`.

---

### Test webhook URL connectivity
**`POST /api/user/settings/webhook/verify`** 🔒

```json
{ "environment": "LIVE" }
```

**Response:**
```json
{
  "result": {
    "url": "https://myapp.com/webhook",
    "reachable": true,
    "status_code": 200,
    "error": null
  }
}
```

---

### View delivery logs
**`GET /api/user/settings/webhook/logs`** 🔒

Query params:

| Param | Example | Description |
|---|---|---|
| `page` | `1` | Pagination |
| `limit` | `20` | Max 100 |
| `event` | `payment.confirmed` | Filter by event type |
| `success` | `false` | Filter failed deliveries |

**Response:**
```json
{
  "result": {
    "data": [
      {
        "event": "payment.confirmed",
        "webhookUrl": "https://...",
        "statusCode": 200,
        "success": true,
        "attempt": 1,
        "createdAt": "2026-06-13T10:45:00.000Z"
      }
    ],
    "meta": { "currentPage": 1, "total": 47 }
  }
}
```

---

## 5. Settings — Payout (Bank Account)

### Get payout settings
**`GET /api/client/settings/payout`** 🔒

```json
{
  "result": {
    "type": "FIAT",
    "bank_account_no": "0123456789",
    "bank_name": "First Bank",
    "account_name": "John Doe",
    "bank_code": "011",
    "currency_id": "ngn-uuid",
    "network_id": null,
    "wallet_address": null
  }
}
```

---

### Save payout details
**`POST /api/client/settings/payout`** 🔒 — `application/json`

**For fiat (bank account):**
```json
{
  "type": "FIAT",
  "bank_account_no": "0123456789",
  "bank_name": "First Bank",
  "account_name": "John Doe",
  "bank_code": "011",
  "currency_id": "ngn-uuid"
}
```

**For crypto:**
```json
{
  "type": "CRYPTO",
  "wallet_address": "0xAbC123...",
  "network_id": "evm-network-uuid",
  "currency_id": "usdt-uuid"
}
```

> ⚠ Bank details saved here are automatically used for fiat withdrawals. Users do **not** enter bank details on the withdrawal screen.

---

## 6. Settings — General

### Get general settings
**`GET /api/user/settings/general`** 🔒

```json
{
  "result": {
    "fee_bearer": "BUSINESS",
    "current_environment": "TEST",
    "payout_interval": "INSTANT",
    "payout_type": "FIAT"
  }
}
```

---

### Update general settings
**`POST /api/user/settings/general`** 🔒

```json
{
  "current_environment": "LIVE"
}
```
All fields optional:
- `fee_bearer`: `BUSINESS` | `CUSTOMERS`
- `current_environment`: `LIVE` | `TEST`
- `payout_interval`: `INSTANT` | `DAILY` | `WEEKLY`
- `payout_type`: `CRYPTO` | `FIAT`

---

## 7. AI Shop Builder

### Available templates
| Template | Label | Description |
|---|---|---|
| `yanga-default` | Default Shop | Basic storefront with essential features |
| `fashion-store` | Fashion Store | Optimized for fashion/apparel with lookbooks |
| `digital-goods` | Digital Goods | For digital products and online services |
| `service-booking` | Service Booking | For service-based businesses |
| `ai-custom` | AI Custom | Fully AI-generated custom storefront |

Each template has different `features`. See `GET /api/user/shop` response for the `features` object.

---

### List all shops
**`GET /api/user/shops`** 🔒

Returns all shops for the logged-in user.

**Response 200:**
```json
{
  "error": false,
  "message": "Shops retrieved",
  "result": [
    {
      "id": "uuid",
      "business_name": "Adaeze Fabrics",
      "subdomain": "adaeze-fabrics",
      "shop_url": "https://adaeze-fabrics.yourdomain.com",
      "status": "published",
      "currency": "NGN",
      "shop_type": "default",
      "template": "yanga-default",
      "features": {
        "allow_product_images": true,
        "allow_product_variants": true,
        "allow_product_categories": true,
        "allow_banner": true,
        "allow_logo": true,
        "allow_ai_chat": false,
        "max_products": 50,
        "max_images_per_product": 5,
        "allowed_product_types": ["physical", "digital"],
        "allow_pay_on_delivery": true,
        "allowed_currency_ids": []
      },
      "customization_access": { ... },
      "payment_gateway": { ... },
      "preview": { ... },
      "created_at": "2026-06-14T10:00:00.000Z"
    }
  ]
}
```

---

### Get shop
**`GET /api/user/shop`** 🔒

Query: `shop_id?` — if provided, returns that specific shop; otherwise returns the first shop.

**Response 200:**
```json
{
  "result": {
    "id": "uuid",
    "business_name": "Adaeze Fabrics",
    "subdomain": "adaeze-fabrics",
    "shop_url": "https://adaeze-fabrics.yourdomain.com",
    "description": "...",
    "logo_url": "https://res.cloudinary.com/...",
    "banner_url": null,
    "theme_config": {
      "primaryColor": "#E84C3D",
      "accentColor": "#D4AF37",
      "fontFamily": "Inter",
      "layout": "grid",
      "template": "yanga-default"
    },
    "status": "draft",
    "currency": "NGN",
    "shop_type": "default",
    "template": "yanga-default",
    "features": {
      "allow_product_images": true,
      "allow_product_variants": true,
      "allow_product_categories": true,
      "allow_banner": true,
      "allow_logo": true,
      "allow_ai_chat": false,
      "max_products": 50,
      "max_images_per_product": 5,
      "allowed_product_types": ["physical", "digital"],
      "allow_pay_on_delivery": true,
      "allowed_currency_ids": []
    },
    "created_at": "2026-06-14T10:00:00.000Z"
  }
}
```

Returns `result: null` if the user has no shop yet.

---

### Create shop
**`POST /api/user/shop`** 🔒

```json
{
  "business_name": "Adaeze Fabrics",
  "subdomain": "adaeze-fabrics",
  "description": "Premium Ankara fashion",
  "currency": "NGN",
  "template": "yanga-default"
}
```

> `subdomain` becomes the URL prefix. Only lowercase letters, numbers, and hyphens allowed. Must be globally unique.
> `template` is optional; defaults to `yanga-default`. Use `ai-custom` for AI-generated shops.

---

### Update shop
**`PUT /api/user/shop`** 🔒

```json
{
  "business_name": "New Name",
  "description": "Updated description",
  "status": "published",
  "features": {
    "max_products": 100,
    "allow_product_categories": true
  },
  "theme_config": {
    "primaryColor": "#E84C3D",
    "accentColor": "#D4AF37"
  }
}
```

Fields: `business_name`, `description`, `currency`, `status` (`draft` | `published`), `features` (partial update), `theme_config`, `pages_config`. All optional.

---

### Upload shop logo
**`POST /api/user/shop/logo`** 🔒 — `multipart/form-data`

| Field | Constraint |
|---|---|
| `logo` | jpg/jpeg/png/webp, max 5MB |

**Response:**
```json
{ "error": false, "message": "Logo uploaded", "data": { "logo_url": "https://res.cloudinary.com/..." } }
```

Stored in Cloudinary under `wt-payments/shop-logo-{shop_unique_id}`.

---

### Upload shop banner
**`POST /api/user/shop/banner`** 🔒 — `multipart/form-data`

| Field | Constraint |
|---|---|
| `banner` | jpg/jpeg/png/webp, max 10MB |

**Response:**
```json
{ "error": false, "message": "Banner uploaded", "data": { "banner_url": "https://res.cloudinary.com/..." } }
```

Stored in Cloudinary under `wt-payments/shop-banner-{shop_unique_id}`.

---

### Chat with AI agent (standard)
**`POST /api/user/shop/ai/chat`** 🔒

Waits for the full AI response before returning. Use this for simple integrations or server-side calls. For animated real-time output use the streaming endpoint below.

```json
{ "message": "Make my store look modern with dark blue and gold colors" }
```

**Response:**
```json
{
  "error": false,
  "message": "AI response",
  "data": {
    "reply": "I've updated your theme with a dark navy (#1A1F3A) primary color and gold (#D4AF37) accents...",
    "action": {
      "action": "update_theme",
      "theme_config": { "primaryColor": "#1A1F3A", "accentColor": "#D4AF37" }
    },
    "conversation_id": "uuid"
  }
}
```

> If `action` is not null and `action.action === "update_theme"`, the theme has already been applied on the backend. Re-fetch `GET /api/user/shop` to get the updated `theme_config`.

---

### Chat with AI agent (streaming) ⚡
**`POST /api/user/shop/ai/chat/stream`** 🔒

Returns a `text/event-stream` (SSE) response. Tokens are pushed one chunk at a time as the AI generates them — use this for a ChatGPT-style animated chat UI.

**Request:** same body as standard chat
```json
{ "message": "Make my store look modern with dark blue and gold colors" }
```

**SSE event types** (each line is `data: <json>\n\n`):

| `type` | Payload | When |
|---|---|---|
| `token` | `{"type":"token","content":"..."}` | AI generates a new token |
| `action` | `{"type":"action","action":{...}}` | AI applies a theme/config change |
| `done` | `{"type":"done","conversation_id":"uuid"}` | Response complete |
| `error` | `{"type":"error","message":"..."}` | Something went wrong |

**Frontend example:**
```js
const res = await fetch('/api/user/shop/ai/chat/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ message: 'Make my store look modern and bold' }),
})
const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const events = buffer.split('\n\n')
  buffer = events.pop() || ''
  for (const event of events) {
    const data = JSON.parse(event.replace('data: ', ''))
    if (data.type === 'token') appendToken(data.content)
    if (data.type === 'action') applyAction(data.action)
    if (data.type === 'done') onDone(data.conversation_id)
    if (data.type === 'error') onError(data.message)
  }
}
```

---

### AI chat history
**`GET /api/user/shop/ai/history`** 🔒

**Response:**
```json
{
  "error": false,
  "message": "Conversation history",
  "data": {
    "messages": [
      { "role": "user", "content": "Make my store modern" },
      { "role": "assistant", "content": "I've updated your theme..." }
    ],
    "summary_memory": "...",
    "entity_memory": { ... }
  }
}
```

---

### Reset AI memory
**`DELETE /api/user/shop/ai/memory`** 🔒

**Response:**
```json
{ "error": false, "message": "AI memory cleared" }
```
Returns `result: null` if the user has no shop yet.

---

### Create shop
**`POST /api/user/shop`** 🔒

```json
{
  "business_name": "Adaeze Fabrics",
  "subdomain": "adaeze-fabrics",
  "description": "Premium Ankara fashion",
  "currency": "NGN"
}
```
> `subdomain` becomes the URL prefix. Only lowercase letters, numbers, and hyphens allowed. Must be globally unique.

---

### Update shop
**`PUT /api/user/shop`** 🔒

```json
{
  "description": "Updated description",
  "status": "published"
}
```
Fields: `business_name`, `description`, `currency`, `status` (`draft` | `published`). All optional.

---

### Upload shop logo
**`POST /api/user/shop/logo`** 🔒 — `multipart/form-data`

| Field | Constraint |
|---|---|
| `logo` | jpg/jpeg/png/webp, max 5MB |

**Response:**
```json
{ "result": { "logo_url": "https://res.cloudinary.com/..." } }
```

---

### Upload shop banner
**`POST /api/user/shop/banner`** 🔒 — `multipart/form-data`

| Field | Constraint |
|---|---|
| `banner` | jpg/jpeg/png/webp, max 10MB |

**Response:**
```json
{ "result": { "banner_url": "https://res.cloudinary.com/..." } }
```

---

### Chat with AI agent (standard)
**`POST /api/user/shop/ai/chat`** 🔒

Waits for the full AI response before returning. Use this for simple integrations or server-side calls. For animated real-time output use the streaming endpoint below.

```json
{ "message": "Make my store look modern with dark blue and gold colors" }
```

**Response:**
```json
{
  "result": {
    "reply": "I've updated your theme with a dark navy (#1A1F3A) primary color and gold (#D4AF37) accents...",
    "action": {
      "action": "update_theme",
      "theme_config": { "primaryColor": "#1A1F3A", "accentColor": "#D4AF37" }
    },
    "conversation_id": "uuid"
  }
}
```

> If `action` is not null and `action.action === "update_theme"`, the theme has already been applied on the backend. Re-fetch `GET /api/user/shop` to get the updated `theme_config`.

---

### Chat with AI agent (streaming) ⚡
**`POST /api/user/shop/ai/chat/stream`** 🔒

Returns a `text/event-stream` (SSE) response. Tokens are pushed one chunk at a time as the AI generates them — use this for a ChatGPT-style animated chat UI.

**Request:** same body as standard chat
```json
{ "message": "Make my store look modern with dark blue and gold colors" }
```

**SSE event types** (each line is `data: <json>\n\n`):

| `type` | Payload | When |
|---|---|---|
| `token` | `{ "type": "token", "content": "..." }` | Each generated text chunk |
| `action` | `{ "type": "action", "action": { ... } }` | When AI returns a JSON action (theme update etc.) — theme already applied |
| `done` | `{ "type": "done", "conversation_id": "uuid" }` | Stream complete |
| `error` | `{ "type": "error", "message": "..." }` | Something failed |

**React integration:**
```tsx
const sendMessage = async (userMsg: string, token: string) => {
  const res = await fetch('/api/user/shop/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: userMsg }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      if (!event.startsWith('data: ')) continue
      const parsed = JSON.parse(event.slice(6))

      if (parsed.type === 'token') {
        reply += parsed.content
        setCurrentReply(reply)          // stream into UI in real time
      }
      if (parsed.type === 'action') {
        await refreshShop()             // theme was updated — re-fetch shop
      }
      if (parsed.type === 'done') {
        setConversationId(parsed.conversation_id)
      }
    }
  }
}
```

> **Do not use `EventSource`** — it only supports GET requests. Use `fetch` with a `ReadableStream` reader as shown above.

---

### Get AI conversation history
**`GET /api/user/shop/ai/history`** 🔒

Returns the current message buffer plus the compressed memory tiers.

```json
{
  "result": {
    "messages": [
      { "role": "user", "content": "Make my store look modern..." },
      { "role": "assistant", "content": "I've updated your theme to a clean modern look..." }
    ],
    "summary_memory": "The merchant wants a modern minimalist shop with dark navy and gold colors. They sell Ankara fabrics in 3 categories.",
    "entity_memory": {
      "primaryColor": "#1A1F3A",
      "accentColor": "#D4AF37",
      "layout": "grid",
      "styleKeywords": ["modern", "bold", "luxury"],
      "productCategories": ["Fabrics", "Accessories"]
    }
  }
}
```

> `messages` contains only the last 10 turns (buffer). Older context is preserved in `summary_memory` and `entity_memory` — the agent always has full context even if `messages` is short.

---

### Reset AI memory
**`DELETE /api/user/shop/ai/memory`** 🔒

Clears all three memory tiers (buffer, summary, entities). The agent starts completely fresh on the next chat. The shop itself (theme, products) is not affected.

---

## 8. Shop Products

### List products
**`GET /api/user/shop/products`** 🔒

Query params: `page`, `limit`, `category`, `active` (`true`/`false`)

```json
{
  "error": false,
  "message": "Products retrieved",
  "data": {
    "data": [
      {
        "uniqueId": "uuid",
        "name": "Premium Ankara Fabric",
        "price": 15000,
        "currency": "NGN",
        "images": [{ "url": "https://...", "publicId": "wt-payments/..." }],
        "category": "Fabrics",
        "stock": 50,
        "trackStock": true,
        "isActive": true,
        "variants": { "sizes": ["S", "M", "L"], "colors": ["Red", "Blue"] }
      }
    ],
    "meta": { "currentPage": 1, "perPage": 20, "total": 12 }
  }
}
```

---

### Create product
**`POST /api/user/shop/products`** 🔒

```json
{
  "name": "Premium Ankara Fabric - 6 yards",
  "price": 15000,
  "description": "100% cotton, vibrant traditional patterns",
  "category": "Fabrics",
  "stock": 50,
  "track_stock": true,
  "variants": { "sizes": ["S", "M", "L"], "colors": ["Red", "Blue"] },
  "product_type": "physical"
}
```

**Validation rules (enforced by shop `features`):**
- `max_products` — cannot exceed the shop's product limit
- `allowed_product_types` — `product_type` must be one of the allowed types for the shop
- `allow_product_categories` — if `false`, `category` must not be provided
- `allow_product_variants` — if `false`, `variants` must not be provided

Check the shop's `features` via `GET /api/user/shop` before creating products.

---

### Update product
**`PUT /api/user/shop/products/:productId`** 🔒

Same fields as create, all optional.

---

### Delete product (soft)
**`DELETE /api/user/shop/products/:productId`** 🔒

Sets `is_active = false`. Product stays in DB.

---

### Upload product images
**`POST /api/user/shop/products/:productId/images`** 🔒 — `multipart/form-data`

| Field | Constraint |
|---|---|
| `images` (array) | jpg/jpeg/png/webp, max 5MB each, max 5 per batch |

**Response:**
```json
{
  "error": false,
  "message": "Images uploaded",
  "data": {
    "images": [
      { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product-..." }
    ]
  }
}
```

Stored in Cloudinary under `wt-payments/shop-product-{product_unique_id}`.

**Validation:**
- Total images per product cannot exceed `features.max_images_per_product` (default: 5, up to 10 depending on template)

---

### Delete a product image
**`DELETE /api/user/shop/products/:productId/images/:publicId`** 🔒

`:publicId` must be URL-encoded.

Deletes from Cloudinary and removes from the product's `images` array.

---

## 9. Payment Intents

### Get payment history
**`GET /api/user/payment-intent/history`** 🔒

Query: `page`, `limit`, `status`

```json
{
  "result": {
    "data": [
      {
        "transaction_id": "uuid",
        "reference_id": "order_123",
        "amount": 50000,
        "currency": "NGN",
        "status": "payment_completed",
        "crypto_amount": "32.5",
        "crypto_currency": "USDT",
        "network": "BSC",
        "tx_hash": "0xabc...",
        "wallet_address": "0xdef...",
        "created_at": "...",
        "completed_at": "..."
      }
    ]
  }
}
```

**Status values:** `payment_created` | `incomplete_payment` | `awaiting_confirmation` | `payment_completed`

---

## 10. Withdrawals

### Get fee quote
**`GET /api/user/withdrawal/quote`** 🔒

Query: `amount` (number), `type` (`crypto` | `fiat`)

```json
{
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

---

### Initiate withdrawal (sends OTP)
**`POST /api/user/withdrawal/initiate`** 🔒

**For fiat** (bank details come from saved payout settings — no bank fields needed):
```json
{
  "type": "fiat",
  "user_wallet_id": "wallet-uuid",
  "amount": 100
}
```

**For crypto:**
```json
{
  "type": "crypto",
  "user_wallet_id": "wallet-uuid",
  "amount": 50,
  "crypto_currency_id": "currency-uuid",
  "network_id": "network-uuid",
  "recipient_address": "0xAbC123..."
}
```

**Response:**
```json
{ "result": { "otp_id": "otp-uuid", "fees": { ... } } }
```
> An OTP is sent to the user's registered email.

---

### Confirm withdrawal (verify OTP)
**`POST /api/user/withdrawal/confirm`** 🔒

```json
{
  "otp_id": "otp-uuid",
  "otp_code": "123456"
}
```

**Response:**
```json
{ "result": { "status": "completed", "tx_hash": "0xabc..." } }
```

---

### Withdrawal history
**`GET /api/user/withdrawals/history`** 🔒

Query: `page`, `limit`, `status`

---

### Payout history
**`GET /api/user/payout/history`** 🔒

Query: `page`, `limit`, `type` (`all` | `crypto` | `fiat`), `status`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "paid_on": "04 Sept. 2025",
        "method": "Crypto",
        "crypto_currency": "USDC",
        "wallet": "usdt.e723648475",
        "amount": 200,
        "status": "completed"
      }
    ],
    "meta": {
      "total": 2,
      "per_page": 20,
      "current_page": 1,
      "last_page": 1
    }
  },
  "summary": {
    "total_payout": 205,
    "pending_payout": 105,
    "current_pending_interval": 20
  }
}
```

---

## 11. Dashboard Stats

### Stats cards
**`GET /api/dashboard/stats`** 🔒

```json
{
  "result": {
    "wallet_balance": 1240.50,
    "total_payouts": 890.00,
    "total_payments_processed": 15600.00,
    "payment_count": 42
  }
}
```

---

### Payout chart
**`GET /api/dashboard/payout-chart`** 🔒

Returns time-series data for the payout chart.

---

### Analytical transactions
**`GET /api/dashboard/analytical-transactions`** 🔒

Returns recent transaction list for the analytics section.

---

## 12. Available Assets

**`GET /api/available-assets`** — No auth required

Returns all supported crypto currencies and networks for the payment widget.

```json
{
  "result": [
    {
      "name": "Tether USD",
      "symbol": "USDT",
      "logo": "https://...",
      "network": { "name": "BSC", "logo": "https://..." }
    },
    {
      "name": "CKB",
      "symbol": "CKB",
      "logo": "https://...",
      "network": { "name": "Nervos", "logo": "https://..." }
    }
  ]
}
```

---

## 13. Error Handling

All error responses follow this shape:

```json
{ "error": true, "data": "Human-readable message", "code": 400 }
```

For validation errors:
```json
{
  "error": true,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Email is required" }],
  "code": 422
}
```

| Code | Meaning |
|---|---|
| `400` | Bad request / business logic error |
| `401` | Unauthenticated or token expired |
| `422` | Validation failure |
| `404` | Resource not found |
| `500` | Server error |

---

## 14. Axios Setup (Recommended)

```js
// api.js
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:3335',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally (token expired / inactive for 7 min)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wt_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

**Login flow:**
```js
  const res = await api.post('/api/user/account/login', { email, password })
localStorage.setItem('wt_token', res.data.result.token)
```

**File upload:**
```js
const form = new FormData()
form.append('profile_image', file)
await api.post('/api/user/account-info/profile-image', form, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
```

**Multiple product images:**
```js
const form = new FormData()
files.forEach((f) => form.append('images', f))
await api.post(`/api/user/shop/products/${productId}/images`, form, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
```

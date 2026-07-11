# WT Payments — Shop Builder API Reference

**Base URL:** `https://your-api-domain.com`  
**Auth:** All authenticated endpoints require `Authorization: Bearer <token>` header.  
**Content-Type:** `application/json` unless marked as multipart.

---

## Table of Contents
1. [Shop Management](#1-shop-management)
2. [Shop Media](#2-shop-media)
3. [AI Customization Chat](#3-ai-customization-chat)
4. [AI Customization Unlock Payment](#4-ai-customization-unlock-payment)
5. [Product Management](#5-product-management)
6. [Payment Links](#6-payment-links)
7. [Customer Checkout](#7-customer-checkout)
8. [General Error Shapes](#8-general-error-shapes)

---

## 1. Shop Management

### POST `/api/user/shop`
Create a new shop. Supports two modes: `default` (simple, no payment required) and `ai_custom` (AI-assisted, requires unlock payment).

**Auth required: Yes**

#### Payload — Default shop (simple setup)
```json
{
  "business_name": "My Fashion Store",
  "subdomain": "myfashionstore",
  "description": "Affordable fashion for everyone",
  "currency": "NGN",
  "shop_type": "default"
}
```

#### Payload — Legacy/template fields also accepted
```json
{
  "name": "My Fashion Store",
  "subdomain": "myfashionstore",
  "primaryCategory": "fashion",
  "allowPayOnDelivery": true,
  "acceptedCurrencyIds": ["<currency-uuid>"],
  "currency": "NGN"
}
```

#### Payload — AI custom shop
```json
{
  "business_name": "My Premium Store",
  "subdomain": "mypremiumstore",
  "description": "Premium products with AI design",
  "currency": "NGN",
  "shop_type": "ai_custom"
}
```

#### Success Response `200`
```json
{
  "message": "Shop created successfully",
  "data": {
    "id": "uuid",
    "business_name": "My Fashion Store",
    "subdomain": "myfashionstore",
    "shop_url": "https://myfashionstore.yourdomain.com",
    "description": "Affordable fashion for everyone",
    "logo_url": null,
    "banner_url": null,
    "theme_config": null,
    "pages_config": null,
    "status": "published",
    "currency": "NGN",
    "shop_type": "default",
    "template": "yanga-default",
    "customization_access": {
      "required": false,
      "paid": false,
      "paid_at": null,
      "payment_reference_id": null
    },
    "payment_gateway": {
      "enabled": true,
      "payment_link_id": "uuid",
      "checkout_url": "/api/pay/pl_abc123"
    },
    "preview": {
      "url": "https://myfashionstore.yourdomain.com",
      "iframe_src": "https://myfashionstore.yourdomain.com",
      "is_live": true
    },
    "created_at": "2026-07-11T10:00:00.000Z"
  }
}
```

> **Shop preview modal:** After creating or updating a shop, use `preview.iframe_src` to render the live shop inside an `<iframe>` in a modal so the merchant can see what their storefront looks like. Show an "Open in new tab" button pointing to `preview.url`. Only show the iframe when `preview.is_live` is `true` (i.e. `status === "published"`). For `draft` shops, show a message: *"Publish your shop to preview it"*.

> For `ai_custom` shops, `customization_access.required` will be `true` and `paid` will be `false` until the user completes the unlock payment. AI chat endpoints will return an error until paid.

#### Error Responses
```json
{ "message": "business_name is required." }
{ "message": "subdomain is required." }
{ "message": "Subdomain \"mystore\" is already taken." }
{ "message": "You already have a shop. Use PUT /api/user/shop to update it." }
```

---

### GET `/api/user/shop`
Fetch the authenticated user's shop.

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "Shop retrieved",
  "data": {
    "id": "uuid",
    "business_name": "My Fashion Store",
    "subdomain": "myfashionstore",
    "shop_url": "https://myfashionstore.yourdomain.com",
    "description": "...",
    "logo_url": "https://res.cloudinary.com/...",
    "banner_url": null,
    "theme_config": {
      "primaryColor": "#1C2B4A",
      "accentColor": "#F2A93B",
      "fontFamily": "Inter",
      "layout": "grid",
      "heroText": "Welcome to My Store",
      "heroSubtext": "Best deals in town"
    },
    "pages_config": null,
    "status": "published",
    "currency": "NGN",
    "shop_type": "default",
    "template": "yanga-default",
    "customization_access": {
      "required": false,
      "paid": false,
      "paid_at": null,
      "payment_reference_id": null
    },
    "payment_gateway": {
      "enabled": true,
      "payment_link_id": "uuid",
      "checkout_url": "/api/pay/pl_abc123"
    },
    "preview": {
      "url": "https://myfashionstore.yourdomain.com",
      "iframe_src": "https://myfashionstore.yourdomain.com",
      "is_live": true
    },
    "created_at": "2026-07-11T10:00:00.000Z"
  }
}
```

#### No Shop Found `200`
```json
{
  "message": "No shop found",
  "data": null
}
```

---

### PUT `/api/user/shop`
Update shop details.

**Auth required: Yes**

#### Payload (all fields optional)
```json
{
  "business_name": "Updated Store Name",
  "description": "New description",
  "currency": "USD",
  "status": "published"
}
```

> `status` must be one of: `draft`, `published`

#### Success Response `200`
```json
{
  "message": "Shop updated",
  "data": {
    "id": "uuid",
    "business_name": "Updated Store Name",
    "status": "published",
    "customization_access": { ... },
    "payment_gateway": { ... }
  }
}
```

#### Error Responses
```json
{ "message": "Shop not found" }
```

---

## 2. Shop Media

### POST `/api/user/shop/logo`
Upload shop logo. **Multipart form-data.**

**Auth required: Yes**

#### Payload
```
Content-Type: multipart/form-data
logo: <file>   (JPG, JPEG, PNG, WEBP — max 5MB)
```

#### Success Response `200`
```json
{
  "message": "Logo uploaded",
  "data": {
    "logo_url": "https://res.cloudinary.com/your-cloud/image/upload/..."
  }
}
```

#### Error Responses
```json
{ "message": "logo file is required." }
{ "message": "File size exceeds 5MB limit." }
```

---

### POST `/api/user/shop/banner`
Upload shop banner. **Multipart form-data.**

**Auth required: Yes**

#### Payload
```
Content-Type: multipart/form-data
banner: <file>  (JPG, JPEG, PNG, WEBP — max 10MB)
```

#### Success Response `200`
```json
{
  "message": "Banner uploaded",
  "data": {
    "banner_url": "https://res.cloudinary.com/your-cloud/image/upload/..."
  }
}
```

---

## 3. AI Customization Chat

> These endpoints only work after the user has unlocked AI customization via a completed payment. For `default` shops, they are accessible freely.

### POST `/api/user/shop/ai/chat`
Send a message to the AI shop builder agent. Non-streaming.

**Auth required: Yes**

#### Payload
```json
{
  "message": "Make my shop look premium and modern with dark blue and gold colors"
}
```

#### Success Response `200`
```json
{
  "message": "AI response",
  "data": {
    "reply": "Great choice! I've updated your theme with a premium dark blue (#1C2B4A) primary and gold accent (#F2A93B)...",
    "action": {
      "action": "update_theme",
      "theme_config": {
        "primaryColor": "#1C2B4A",
        "accentColor": "#F2A93B",
        "fontFamily": "Playfair Display",
        "layout": "grid",
        "heroText": "Premium Quality, Every Time",
        "heroSubtext": "Discover our curated collection"
      }
    },
    "conversation_id": "uuid"
  }
}
```

> `action` is `null` when the AI is answering a question rather than updating the theme.

#### Error — Not paid yet
```json
{ "message": "AI customization access requires a completed payment first." }
```

---

### POST `/api/user/shop/ai/chat/stream`
SSE streaming version of the AI chat. Returns `text/event-stream`.

**Auth required: Yes**

#### Payload
```json
{
  "message": "Design a homepage for my fashion store"
}
```

#### Stream Events
```
data: {"type":"token","content":"Great"}
data: {"type":"token","content":" choice"}
data: {"type":"token","content":"!"}
data: {"type":"action","action":{"action":"update_theme","theme_config":{...}}}
data: {"type":"done","conversation_id":"uuid"}
```

> On error:
```
data: {"type":"error","message":"AI stream interrupted."}
```

---

### GET `/api/user/shop/ai/history`
Fetch full conversation history including memory tiers.

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "Conversation history",
  "data": {
    "messages": [
      { "role": "user", "content": "Make my shop look modern" },
      { "role": "assistant", "content": "Here's a modern theme for you..." }
    ],
    "summary_memory": "Merchant prefers dark blue and gold. Target audience is fashion-forward 18-35 year olds.",
    "entity_memory": {
      "primaryColor": "#1C2B4A",
      "accentColor": "#F2A93B",
      "styleKeywords": ["premium", "modern", "dark"],
      "productCategories": ["fashion", "accessories"]
    }
  }
}
```

---

### DELETE `/api/user/shop/ai/memory`
Reset all AI conversation memory (fresh start).

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "AI memory cleared",
  "data": null
}
```

---

## 4. AI Customization Unlock Payment

For `ai_custom` shops, users pay with NGN via Paystack. After payment, the backend converts the NGN to the chosen stablecoin, credits the user's wallet, and unlocks AI chat access.

### POST `/api/user/shop/customization/pay`
Initiate a Paystack NGN charge to unlock AI customization. Returns a checkout URL to redirect the user to.

**Auth required: Yes**

#### Payload
```json
{
  "amount_naira": 5000,
  "target_currency_id": "<stablecoin-currency-uuid>"
}
```

> Get available stablecoins from `GET /api/currencies` — look for currencies with `type: "crypto"`.

#### Success Response `200`
```json
{
  "message": "Payment initiated — complete on Paystack to unlock AI customization",
  "data": {
    "deposit_id": "uuid",
    "reference": "shop-custom-uuid",
    "amount_naira": 5000,
    "target_currency": "USDT",
    "checkout_url": "https://checkout.paystack.com/abc123",
    "access_code": "abc123",
    "shop_id": "uuid"
  }
}
```

> Redirect the user to `checkout_url`. After payment, Paystack fires a webhook automatically. The frontend should listen for the SSE event `shop.customization_unlocked` or poll the status endpoint.

#### Error Responses
```json
{ "message": "You must create a shop first." }
{ "message": "amount_naira must be greater than 0" }
{ "message": "Invalid target_currency_id — currency not found" }
{ "message": "AI customization is already unlocked for this shop" }
```

---

### GET `/api/user/shop/customization/status`
Poll the unlock state and latest deposit status.

**Auth required: Yes**

#### Success Response — Pending payment `200`
```json
{
  "message": "Customization status",
  "data": {
    "shop_id": "uuid",
    "unlocked": false,
    "unlocked_at": null,
    "latest_deposit": {
      "deposit_id": "uuid",
      "status": "pending",
      "amount_naira": 5000,
      "credited_amount": null,
      "currency": "USDT",
      "failure_reason": null,
      "created_at": "2026-07-11T10:00:00.000Z",
      "credited_at": null
    }
  }
}
```

#### Success Response — Unlocked `200`
```json
{
  "message": "Customization status",
  "data": {
    "shop_id": "uuid",
    "unlocked": true,
    "unlocked_at": "2026-07-11T10:05:00.000Z",
    "latest_deposit": {
      "deposit_id": "uuid",
      "status": "credited",
      "amount_naira": 5000,
      "credited_amount": 3.14,
      "currency": "USDT",
      "failure_reason": null,
      "created_at": "2026-07-11T10:00:00.000Z",
      "credited_at": "2026-07-11T10:05:00.000Z"
    }
  }
}
```

> Deposit `status` values: `pending` → `fiat_received` → `converting` → `credited` (or `failed`)

---

### SSE Event — Customization Unlocked
After payment is confirmed and conversion completes, the backend pushes this over the SSE connection:
```json
{
  "event": "shop.customization_unlocked",
  "data": {
    "shop_id": "uuid",
    "shop_name": "My Premium Store",
    "unlocked_at": "2026-07-11T10:05:00.000Z"
  }
}
```

### SSE Event — Wallet Credited
Also sent over SSE when the stablecoin lands in the wallet:
```json
{
  "event": "wallet.deposit_credited",
  "data": {
    "deposit_id": "uuid",
    "currency": "USDT",
    "credited_amount": 3.14,
    "new_balance": 13.14,
    "naira_amount": 5000,
    "exchange_rate": 1590.0
  }
}
```

---

## 5. Product Management

### GET `/api/user/shop/products`
List products for the user's shop.

**Auth required: Yes**

#### Query Parameters
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `category` | string | Filter by category |
| `active` | boolean | Filter by active status |

#### Success Response `200`
```json
{
  "message": "Products retrieved",
  "data": {
    "meta": {
      "total": 5,
      "per_page": 20,
      "current_page": 1,
      "last_page": 1
    },
    "data": [
      {
        "id": "uuid",
        "name": "Cool T-Shirt",
        "price": 2500,
        "currency": "NGN",
        "description": "Premium quality shirt",
        "category": "fashion",
        "stock": 10,
        "track_stock": true,
        "is_active": true,
        "images": [
          { "url": "https://res.cloudinary.com/...", "publicId": "shop-product-uuid" }
        ],
        "variants": null,
        "created_at": "2026-07-11T10:00:00.000Z"
      }
    ]
  }
}
```

---

### POST `/api/user/shop/products`
Create a new product.

**Auth required: Yes**

#### Payload
```json
{
  "name": "Cool T-Shirt",
  "price": 2500,
  "description": "Premium quality shirt",
  "category": "fashion",
  "stock": 10,
  "track_stock": true,
  "variants": null
}
```

#### Success Response `200`
```json
{
  "message": "Product created",
  "data": {
    "id": "uuid",
    "name": "Cool T-Shirt",
    "price": 2500,
    "currency": "NGN",
    "category": "fashion",
    "stock": 10,
    "is_active": true
  }
}
```

#### Error Responses
```json
{ "message": "name is required." }
{ "message": "price is required." }
{ "message": "price must be a number." }
```

---

### PUT `/api/user/shop/products/:productId`
Update a product. All fields optional.

**Auth required: Yes**

#### Payload
```json
{
  "name": "Updated T-Shirt",
  "price": 3000,
  "stock": 5,
  "is_active": true
}
```

#### Success Response `200`
```json
{
  "message": "Product updated",
  "data": { ... }
}
```

---

### DELETE `/api/user/shop/products/:productId`
Soft-delete a product (sets `is_active = false`).

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "Product removed",
  "data": null
}
```

---

### POST `/api/user/shop/products/:productId/images`
Upload product images. **Multipart form-data.**

**Auth required: Yes**

#### Payload
```
Content-Type: multipart/form-data
images: <file1>
images: <file2>   (max 5 images, JPG/JPEG/PNG/WEBP, max 5MB each)
```

#### Success Response `200`
```json
{
  "message": "Images uploaded",
  "data": {
    "images": [
      { "url": "https://res.cloudinary.com/...", "publicId": "shop-product-uuid-0" },
      { "url": "https://res.cloudinary.com/...", "publicId": "shop-product-uuid-1" }
    ]
  }
}
```

#### Error Responses
```json
{ "message": "At least one image is required." }
{ "message": "Maximum 5 images per product." }
```

---

### DELETE `/api/user/shop/products/:productId/images/:publicId`
Remove a specific product image.

**Auth required: Yes**

> `:publicId` must be URL-encoded.

#### Success Response `200`
```json
{
  "message": "Image deleted",
  "data": {
    "images": [...]
  }
}
```

---

## 6. Payment Links

### POST `/api/client/payment-links`
Create a shareable checkout link for the shop.

**Auth required: Yes**

#### Payload
```json
{
  "title": "Store Checkout",
  "description": "Pay for your order",
  "fiat_currency": "NGN",
  "fiat_amount": 5000,
  "is_single_use": false,
  "usage_limit": 100,
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

> `fiat_currency` and `fiat_amount` are optional. If omitted, the customer supplies the amount at checkout.
> `expires_at` and `usage_limit` are optional.

#### Success Response `201`
```json
{
  "message": "Payment link created",
  "data": {
    "link": {
      "id": "uuid",
      "slug": "pl_abc123",
      "title": "Store Checkout",
      "description": "Pay for your order",
      "fiat_amount": 5000,
      "fiat_currency_id": "uuid",
      "status": "active",
      "is_single_use": false,
      "usage_count": 0,
      "usage_limit": 100,
      "expires_at": "2026-12-31T23:59:59.000Z",
      "created_at": "2026-07-11T10:00:00.000Z",
      "checkout_url": "/api/pay/pl_abc123"
    },
    "checkout_url": "/api/pay/pl_abc123"
  }
}
```

#### Error Responses
```json
{ "message": "title is required" }
{ "message": "fiat_currency is required when fiat_amount is provided" }
{ "message": "Unsupported fiat currency: XYZ" }
```

---

### GET `/api/client/payment-links`
List all payment links for the authenticated merchant.

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "Payment links fetched",
  "data": {
    "links": [...]
  }
}
```

---

### GET `/api/client/payment-links/:id`
Get a single payment link by UUID.

**Auth required: Yes**

---

### PATCH `/api/client/payment-links/:id`
Update a payment link.

**Auth required: Yes**

#### Payload (all optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "fiat_amount": 6000,
  "status": "inactive",
  "is_single_use": true,
  "usage_limit": 50,
  "expires_at": "2027-01-01T00:00:00.000Z"
}
```

---

### DELETE `/api/client/payment-links/:id`
Delete a payment link.

**Auth required: Yes**

#### Success Response `200`
```json
{
  "message": "Payment link deleted",
  "data": null
}
```

---

## 7. Customer Checkout

These are public endpoints — no auth required. Used by the storefront widget.

### GET `/api/pay/:slug`
Fetch payment link details and available crypto currencies for the checkout widget.

**Auth required: No**

#### Success Response `200`
```json
{
  "error": false,
  "data": {
    "slug": "pl_abc123",
    "title": "Store Checkout",
    "description": "Pay for your order",
    "fiat_amount": 5000,
    "fiat_currency": { "symbol": "NGN", "name": "Nigerian Naira" },
    "is_fixed_amount": true,
    "assets": [
      {
        "currency_id": "uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "BNB Smart Chain", "logo": "https://..." },
        "amount": 3.14
      }
    ]
  }
}
```

#### Error — Inactive link `410`
```json
{
  "error": true,
  "message": "This payment link is no longer active"
}
```

---

### POST `/api/pay/:slug/checkout`
Create a checkout session (PaymentIntent) and get the reference ID.

**Auth required: No**

#### Payload
```json
{
  "fiat_amount": 5000,
  "fiat_currency": "NGN"
}
```

> Only required if the payment link has no fixed amount. If the link has a fixed amount, send an empty body `{}`.

#### Success Response `200`
```json
{
  "message": "Checkout session created",
  "data": {
    "payment_intent_id": "uuid",
    "reference_id": "pl_abc123_1720000000000",
    "fiat_amount": 5000,
    "fiat_currency": "NGN",
    "assets": [
      {
        "currency_id": "uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "BNB Smart Chain", "logo": "https://..." },
        "amount": 3.14
      }
    ]
  }
}
```

#### Error Responses
```json
{ "message": "fiat_amount is required for this payment link" }
{ "message": "fiat_currency is required for this payment link" }
{ "message": "fiat_amount must be a positive number" }
```

---

### POST `/api/pay/:slug/wallet`
Select a crypto currency for the session. Returns the wallet address and QR code.

**Auth required: No**

#### Payload
```json
{
  "reference_id": "pl_abc123_1720000000000",
  "crypto_currency_id": "<currency-uuid>"
}
```

#### Success Response `200`
```json
{
  "error": false,
  "data": {
    "reference_id": "pl_abc123_1720000000000",
    "payment_intent_id": "uuid",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "0xAbCdEf1234567890...",
      "qr_code": "data:image/png;base64,..."
    },
    "fiat": {
      "name": "Nigerian Naira",
      "symbol": "NGN",
      "logo": "https://...",
      "amount": 5000
    },
    "crypto": {
      "name": "Tether USD",
      "symbol": "USDT",
      "logo": "https://...",
      "amount": 3.14,
      "network": {
        "name": "BNB Smart Chain",
        "logo": "https://..."
      }
    }
  }
}
```

#### Error Responses
```json
{ "message": "reference_id is required" }
{ "message": "crypto_currency_id is required" }
{ "message": "Payment session not found" }
{ "message": "Invalid crypto currency" }
{ "message": "Crypto network not found" }
```

---

## 8. General Error Shapes

All errors follow this shape:
```json
{ "message": "Human-readable error description" }
```

### Auth errors
```json
{ "message": "Authentication error!" }
```

### Not found
```json
{ "message": "Shop not found" }
{ "message": "Payment link not found" }
{ "message": "Product not found" }
```

### Payment link expired or inactive
```json
{
  "error": true,
  "message": "This payment link is no longer active"
}
```

### AI customization locked
```json
{ "message": "AI customization access requires a completed payment first." }
```

### Duplicate resource
```json
{ "message": "Reference ID already used" }
{ "message": "Subdomain \"mystore\" is already taken." }
```

---

## SSE (Real-time Events)

Connect once after login and keep the connection open. All real-time updates for payments, wallet credits, and shop unlocks arrive here.

```
GET /api/user/stream
Authorization: Bearer <token>
```

> **Important:** The correct URL is `/api/user/stream`. Do **not** use `/user/stream` (missing `/api` prefix causes a 404).

### Connection example (JavaScript)
```js
const eventSource = new EventSource(
  'https://your-api-domain.com/api/user/stream',
  { headers: { Authorization: `Bearer ${token}` } }
)

eventSource.onmessage = (e) => {
  const payload = JSON.parse(e.data)
  if (payload.event === 'shop.customization_unlocked') {
    // show AI chat panel
  }
  if (payload.event === 'wallet.deposit_credited') {
    // update wallet balance
  }
  if (payload.event === 'transaction.confirmed') {
    // show payment success
  }
}
```

### SSE Events Reference
| Event | When it fires |
|---|---|
| `shop.customization_unlocked` | Paystack payment confirmed + NGN converted to stablecoin |
| `wallet.deposit_credited` | Stablecoin credited to wallet |
| `transaction.confirmed` | Customer crypto payment confirmed |
| `wallet.balance_updated` | Wallet balance changed |
| `transaction.created` | New payment intent created |

---

## Quick-Reference Flow

```
DEFAULT SHOP SETUP
──────────────────
POST /api/user/shop  (shop_type: "default")
  └→ POST /api/user/shop/logo          (upload logo)
  └→ POST /api/user/shop/products      (add products)
  └→ GET  /api/pay/:slug               (public storefront ready)

AI CUSTOM SHOP SETUP
─────────────────────
POST /api/user/shop  (shop_type: "ai_custom")
  └→ POST /api/user/shop/customization/pay   (pay to unlock)
  └→  [redirect user to Paystack checkout URL]
  └→  [listen for SSE: shop.customization_unlocked]
  └→ GET  /api/user/shop/customization/status  (poll if SSE not available)
  └→ POST /api/user/shop/ai/chat              (AI design session)
  └→ POST /api/user/shop/products             (add products)
  └→ GET  /api/pay/:slug                      (public storefront ready)

CUSTOMER CHECKOUT
──────────────────
GET  /api/pay/:slug             (show available currencies)
POST /api/pay/:slug/checkout    (create session, get reference_id)
POST /api/pay/:slug/wallet      (select crypto, get wallet address + QR)
  └→ customer sends crypto to wallet address
  └→ backend confirms via poller/webhook
  └→ merchant receives SSE: transaction.confirmed
```


## 1. Create or fetch a shop

### POST /api/user/shop
Authenticated.

#### Payload
```json
{
  "business_name": "My Store",
  "subdomain": "mystore",
  "description": "My shop description",
  "currency": "NGN",
  "shop_type": "default",
  "template": "yanga-default"
}
```

Supported alternative payload shape for older/default flow:
```json
{
  "name": "My Store",
  "primaryCategory": "fashion",
  "allowPayOnDelivery": true,
  "acceptedCurrencyIds": ["usdt"]
}
```

#### Success response
```json
{
  "message": "Shop created successfully",
  "data": {
    "id": "uuid",
    "business_name": "My Store",
    "subdomain": "mystore",
    "shop_url": "https://mystore.yourdomain.com",
    "description": "My shop description",
    "status": "published",
    "currency": "NGN",
    "shop_type": "default",
    "template": "yanga-default",
    "customization_access": {
      "required": false,
      "paid": false,
      "paid_at": null,
      "payment_reference_id": null
    },
    "payment_gateway": {
      "enabled": true,
      "payment_link_id": "uuid",
      "checkout_url": "/api/pay/slug"
    }
  }
}
```

#### Error response
```json
{
  "message": "business_name is required."
}
```

### GET /api/user/shop
Authenticated.

#### Success response
```json
{
  "message": "Shop retrieved",
  "data": {
    "id": "uuid",
    "business_name": "My Store",
    "subdomain": "mystore",
    "shop_url": "https://mystore.yourdomain.com",
    "status": "published",
    "shop_type": "default",
    "customization_access": {
      "required": false,
      "paid": false,
      "paid_at": null,
      "payment_reference_id": null
    },
    "payment_gateway": {
      "enabled": true,
      "payment_link_id": "uuid",
      "checkout_url": "/api/pay/slug"
    }
  }
}
```

---

## 2. Update shop

### PUT /api/user/shop
Authenticated.

#### Payload
```json
{
  "business_name": "Updated Store",
  "description": "Updated description",
  "currency": "USD",
  "status": "published"
}
```

#### Success response
```json
{
  "message": "Shop updated",
  "data": {
    "id": "uuid",
    "business_name": "Updated Store"
  }
}
```

---

## 3. Upload shop media

### POST /api/user/shop/logo
Authenticated. Multipart form-data.

#### Payload
```text
logo: <file>
```

#### Success response
```json
{
  "message": "Logo uploaded",
  "data": {
    "logo_url": "https://..."
  }
}
```

### POST /api/user/shop/banner
Authenticated. Multipart form-data.

#### Payload
```text
banner: <file>
```

#### Success response
```json
{
  "message": "Banner uploaded",
  "data": {
    "banner_url": "https://..."
  }
}
```

---

## 4. AI customization flow

### POST /api/user/shop/ai/chat
Authenticated.

#### Payload
```json
{
  "message": "Make my shop look premium and modern"
}
```

#### Success response
```json
{
  "message": "AI response",
  "data": {
    "reply": "...",
    "action": null,
    "conversation_id": "uuid"
  }
}
```

#### Error response when AI customization is not paid yet
```json
{
  "message": "AI customization access requires a completed payment first."
}
```

### POST /api/user/shop/ai/chat/stream
Authenticated. Returns SSE stream.

#### Payload
```json
{
  "message": "Make my shop look premium and modern"
}
```

### GET /api/user/shop/ai/history
Authenticated.

#### Success response
```json
{
  "message": "Conversation history",
  "data": {
    "messages": [],
    "summary_memory": null,
    "entity_memory": null
  }
}
```

### DELETE /api/user/shop/ai/memory
Authenticated.

#### Success response
```json
{
  "message": "AI memory cleared",
  "data": null
}
```

---

## 5. Product management

### GET /api/user/shop/products
Authenticated.

#### Query params
- page: number
- limit: number
- category: string
- active: boolean

#### Success response
```json
{
  "message": "Products retrieved",
  "data": {
    "total": 0,
    "perPage": 20,
    "currentPage": 1,
    "lastPage": 1,
    "data": []
  }
}
```

### POST /api/user/shop/products
Authenticated.

#### Payload
```json
{
  "name": "Cool T-Shirt",
  "price": 2500,
  "description": "Premium shirt",
  "category": "fashion",
  "stock": 10,
  "track_stock": true,
  "variants": null
}
```

#### Success response
```json
{
  "message": "Product created",
  "data": {
    "id": "uuid",
    "name": "Cool T-Shirt",
    "price": 2500,
    "currency": "NGN"
  }
}
```

---

## 6. Payment checkout flow

### POST /api/client/payment-links
Authenticated.

#### Payload
```json
{
  "title": "Checkout Link",
  "description": "Custom checkout",
  "fiat_currency": "NGN",
  "fiat_amount": 1000,
  "is_single_use": false,
  "usage_limit": 10,
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

#### Success response
```json
{
  "message": "Payment link created",
  "data": {
    "link": {
      "id": "uuid",
      "slug": "abc123",
      "title": "Checkout Link"
    },
    "checkout_url": "/api/pay/abc123"
  }
}
```

### POST /api/pay/:slug/checkout
Public.

#### Payload
```json
{
  "fiat_amount": 1000,
  "fiat_currency": "NGN"
}
```

#### Success response
```json
{
  "message": "Checkout session created",
  "data": {
    "payment_intent_id": "uuid",
    "reference_id": "abc123_1720000000000",
    "fiat_amount": 1000,
    "fiat_currency": "NGN",
    "assets": []
  }
}
```

### POST /api/pay/:slug/wallet
Public.

#### Payload
```json
{
  "reference_id": "abc123_1720000000000",
  "crypto_currency_id": "uuid"
}
```

#### Success response
```json
{
  "error": false,
  "data": {
    "reference_id": "abc123_1720000000000",
    "payment_intent_id": "uuid",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "...",
      "qr_code_url": "..."
    },
    "fiat": {
      "amount": 1000,
      "currency": "NGN"
    },
    "crypto": {
      "currency": "USDT",
      "network": "Ethereum"
    }
  }
}
```

### POST /api/client/payment-intent
Authenticated.

#### Payload
```json
{
  "reference_id": "order-001",
  "fiat_currency": "NGN",
  "fiat_amount": 1000
}
```

#### Success response
```json
{
  "message": "Payment intent created successfully",
  "data": {
    "fiat_amount": 1000,
    "fiat_currency": "NGN",
    "reference_id": "order-001",
    "assets": []
  }
}
```

### POST /api/user/payment-intent/create-wallet
Authenticated.

#### Payload
```json
{
  "reference_id": "order-001",
  "crypto_currency_id": "uuid"
}
```

#### Success response
```json
{
  "error": false,
  "data": {
    "wallet": {
      "address": "...",
      "qr_code_url": "..."
    }
  }
}
```

---

## 7. Common error patterns

### Validation / bad request
```json
{
  "message": "title is required"
}
```

### Not found
```json
{
  "message": "Payment link not found"
}
```

### Unauthorized
```json
{
  "message": "Authentication error!"
}
```

### Payment-gated customization error
```json
{
  "message": "AI customization access requires a completed payment first."
}
```

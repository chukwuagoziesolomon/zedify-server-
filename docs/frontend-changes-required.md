# WT Payments — Frontend Integration Guide

**Backend URL (development):** `http://localhost:3335`  
**Frontend URL (development):** `http://localhost:3000`

This guide covers every change the frontend needs to correctly integrate with the WT Payments backend for the shop builder, storefront, payments, and real-time events.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Auth — Login and Token](#2-auth--login-and-token)
3. [API Response Shape](#3-api-response-shape)
4. [SSE Real-time Events](#4-sse-real-time-events)
5. [Shop Dashboard](#5-shop-dashboard)
6. [Storefront Page](#6-storefront-page)
7. [Shop Media — Logo and Banner](#7-shop-media--logo-and-banner)
8. [AI Customization Chat](#8-ai-customization-chat)
9. [AI Customization Unlock Payment](#9-ai-customization-unlock-payment)
10. [Product Management](#10-product-management)
11. [Payment Links](#11-payment-links)
12. [Customer Checkout Widget](#12-customer-checkout-widget)
13. [Complete Endpoint Reference](#13-complete-endpoint-reference)
14. [Common Mistakes Checklist](#14-common-mistakes-checklist)

---

## 1. Environment Setup

Create a `.env.local` file at the root of the frontend project:

```env
NEXT_PUBLIC_API_URL=http://localhost:3335
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

Create a shared API helper so all requests go to the right host:

```js
// lib/api.js
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3335'

export async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const json = await res.json()
  return { status: res.status, ...json }
}
```

---

## 2. Auth — Login and Token

### Sign Up

```
POST http://localhost:3335/user/account/signup
```

```js
const res = await fetch(`${API_URL}/user/account/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    first_name: 'John',
    last_name: 'Doe',
    business_name: 'My Business',
    country: 'NG',
    email: 'john@example.com',
    password: 'Password123!',
    password_confirmation: 'Password123!',   // ← required, must match password
    phone: '08012345678',
    business_type: 'starter',               // 'starter' or 'registered'
    bvn: '12345678901',                     // required
  }),
})
const json = await res.json()
// success: json.data === "User created!"
```

### Login

```
POST http://localhost:3335/user/account/login
```

```js
const res = await fetch(`${API_URL}/user/account/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'john@example.com', password: 'Password123!' }),
})
const json = await res.json()

// ⚠️ Token is at json.result.token, NOT json.data.token
const token = json.result.token
localStorage.setItem('token', token)
```

---

## 3. API Response Shape

> **Critical:** The backend always returns `result` for object data, and `data` for a plain message string. Do not confuse the two.

```json
{
  "error": false,
  "data": "Operation successful",   ← always a string message
  "code": 200,
  "result": {                       ← always the actual object/array
    "id": "uuid",
    ...
  }
}
```

```js
// ❌ Wrong — this gets the string message, not the object
const shop = response.data

// ✅ Correct — this gets the actual shop object
const shop = response.result
```

Error responses:
```json
{
  "error": true,
  "message": "business_name is required.",
  "code": 422
}
```

```js
if (json.error) {
  showError(json.message)
  return
}
const shop = json.result
```

---

## 4. SSE Real-time Events

Connect once after login. Keep the connection open for the entire session. All real-time updates (payment confirmations, wallet credits, shop unlocks) arrive here.

```
GET http://localhost:3335/api/user/stream
Authorization: Bearer <token>
```

> ⚠️ The URL must be `/api/user/stream`. Do **not** use `/user/stream` (missing `/api` causes a 404).

```js
// lib/sse.js
export function connectSSE(token, handlers = {}) {
  // EventSource does not support custom headers natively in browsers.
  // Use fetch with a ReadableStream instead:
  const controller = new AbortController()

  fetch(`${API_URL}/api/user/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        try {
          const payload = JSON.parse(line.replace('data:', '').trim())
          if (handlers[payload.event]) handlers[payload.event](payload.data)
        } catch {}
      }
    }
  })

  return () => controller.abort() // call this to disconnect
}
```

Usage in a React component:

```js
useEffect(() => {
  const token = localStorage.getItem('token')
  if (!token) return

  const disconnect = connectSSE(token, {
    'shop.customization_unlocked': (data) => {
      // User paid — unlock the AI chat UI
      setCustomizationUnlocked(true)
      toast.success(`AI customization unlocked for ${data.shop_name}!`)
    },
    'wallet.deposit_credited': (data) => {
      // Stablecoin credited to wallet
      setWalletBalance(data.new_balance)
      toast.success(`${data.credited_amount} ${data.currency} credited to your wallet`)
    },
    'transaction.confirmed': (data) => {
      // Customer paid — show success
      setPaymentStatus('confirmed')
    },
    'wallet.balance_updated': (data) => {
      setWalletBalance(data.total_balance_usd)
    },
  })

  return disconnect
}, [])
```

---

## 5. Shop Dashboard

### Create a shop

```
POST http://localhost:3335/api/user/shop
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop', {
  method: 'POST',
  body: JSON.stringify({
    business_name: 'My Fashion Store',
    subdomain: 'myfashionstore',        // becomes the URL path: /shop/myfashionstore
    description: 'Affordable fashion',
    currency: 'NGN',
    shop_type: 'default',               // 'default' or 'ai_custom'
  }),
})

if (json.error) return showError(json.message)
const shop = json.result
```

Only one shop per user. If a second create is attempted:
```json
{ "message": "You already have a shop. Use PUT /api/user/shop to update it or GET /api/user/shop to view it." }
```

### Get your shop

```
GET http://localhost:3335/api/user/shop
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop')
const shop = json.result

// If user has no shop yet:
// json.data === "No shop found" and json.result === null
```

Full shop object returned:

```json
{
  "id": "uuid",
  "business_name": "My Fashion Store",
  "subdomain": "myfashionstore",
  "shop_url": "http://localhost:3000/shop/myfashionstore",
  "storefront_url": "http://localhost:3000/shop/myfashionstore",
  "checkout_url": "/api/pay/pl_abc123",
  "description": "Affordable fashion",
  "logo_url": null,
  "banner_url": null,
  "theme_config": { "template": "yanga-default" },
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
    "url": "http://localhost:3000/shop/myfashionstore",
    "iframe_src": "http://localhost:3000/shop/myfashionstore",
    "is_live": true
  }
}
```

### Show the shop URL and preview modal

```jsx
// "Open Shop" button
<a href={shop.preview.url} target="_blank" rel="noopener noreferrer">
  Open Shop
</a>

// "Preview in Modal" button
<button onClick={() => setPreviewOpen(true)}>Preview in Modal</button>

// Modal content
{previewOpen && (
  <div className="modal">
    {shop.preview.is_live ? (
      <iframe
        src={shop.preview.iframe_src}
        width="100%"
        height="700px"
        title="Shop Preview"
      />
    ) : (
      <p>Publish your shop to preview it. Update status to "published".</p>
    )}
    <a href={shop.preview.url} target="_blank">Open in new tab</a>
    <button onClick={() => setPreviewOpen(false)}>Close</button>
  </div>
)}
```

### Update shop

```
PUT http://localhost:3335/api/user/shop
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop', {
  method: 'PUT',
  body: JSON.stringify({
    business_name: 'Updated Name',   // optional
    description: 'New description', // optional
    currency: 'NGN',                // optional
    status: 'published',            // optional — 'draft' or 'published'
  }),
})
const shop = json.result
```

---

## 6. Storefront Page

The storefront is the public-facing shop page at `/shop/[subdomain]`. It requires **no authentication**.

```
GET http://localhost:3335/api/storefront/:subdomain
```

```js
// pages/shop/[subdomain].js  (Next.js Pages Router)
export async function getServerSideProps({ params }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/storefront/${params.subdomain}`
  )
  const json = await res.json()

  if (json.error || !json.data) {
    return { notFound: true }
  }

  return { props: { shop: json.data } }
}

export default function StorefrontPage({ shop }) {
  return (
    <div style={{ backgroundColor: shop.theme_config?.primaryColor }}>
      {shop.logo_url && <img src={shop.logo_url} alt={shop.business_name} />}
      {shop.banner_url && <img src={shop.banner_url} alt="banner" />}
      <h1>{shop.business_name}</h1>
      <p>{shop.description}</p>

      {/* Products */}
      {shop.products.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>{product.currency} {product.price}</p>
          {product.images?.[0] && <img src={product.images[0].url} />}
        </div>
      ))}

      {/* Buy / Pay button */}
      {shop.checkout_url && (
        <a href={`${process.env.NEXT_PUBLIC_API_URL}${shop.checkout_url}`}>
          Buy Now
        </a>
      )}
    </div>
  )
}
```

Response from `/api/storefront/:subdomain`:

```json
{
  "error": false,
  "data": {
    "id": "uuid",
    "business_name": "My Fashion Store",
    "subdomain": "myfashionstore",
    "description": "Affordable fashion",
    "logo_url": "https://res.cloudinary.com/...",
    "banner_url": null,
    "theme_config": { "template": "yanga-default", "primaryColor": "#1C2B4A" },
    "currency": "NGN",
    "status": "published",
    "checkout_url": "/api/pay/pl_abc123",
    "payment_link_id": "uuid",
    "products": [
      {
        "id": "uuid",
        "name": "Cool T-Shirt",
        "price": 2500,
        "currency": "NGN",
        "description": "Premium shirt",
        "category": "fashion",
        "images": [{ "url": "https://...", "publicId": "..." }],
        "stock": 10,
        "variants": null
      }
    ]
  }
}
```

> If the shop status is `draft`, show a "Coming Soon" screen instead of the full storefront.

---

## 7. Shop Media — Logo and Banner

These are multipart form-data uploads. Do **not** set `Content-Type: application/json` for these requests.

### Upload Logo

```
POST http://localhost:3335/api/user/shop/logo
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

```js
const formData = new FormData()
formData.append('logo', fileInputRef.current.files[0])

const res = await fetch(`${API_URL}/api/user/shop/logo`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  // Do NOT set Content-Type — let the browser set it with the boundary
  body: formData,
})
const json = await res.json()
const logoUrl = json.result?.logo_url  // "https://res.cloudinary.com/..."
```

### Upload Banner

```
POST http://localhost:3335/api/user/shop/banner
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

```js
const formData = new FormData()
formData.append('banner', fileInputRef.current.files[0])

const res = await fetch(`${API_URL}/api/user/shop/banner`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
})
const json = await res.json()
const bannerUrl = json.result?.banner_url
```

---

## 8. AI Customization Chat

> Only available after unlocking AI customization (see section 9). For `default` shops, it is always accessible.

### Non-streaming chat

```
POST http://localhost:3335/api/user/shop/ai/chat
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'Make my shop look premium and modern' }),
})

const reply = json.result.reply            // AI text response
const action = json.result.action          // null OR { action: "update_theme", theme_config: {...} }
const conversationId = json.result.conversation_id

// If the AI updated the theme, refresh the shop:
if (action?.action === 'update_theme') {
  refetchShop()
}
```

### Streaming chat (token-by-token)

```
POST http://localhost:3335/api/user/shop/ai/chat/stream
Authorization: Bearer <token>
```

```js
async function streamAIChat(message, onToken, onDone, onAction) {
  const res = await fetch(`${API_URL}/api/user/shop/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ message }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const event = JSON.parse(line.replace('data:', '').trim())

      if (event.type === 'token') onToken(event.content)
      if (event.type === 'action') onAction(event.action)
      if (event.type === 'done') onDone(event.conversation_id)
      if (event.type === 'error') console.error('AI error:', event.message)
    }
  }
}

// Usage
streamAIChat(
  'Give my shop a luxury feel',
  (token) => setReply(prev => prev + token),
  (convId) => console.log('Done', convId),
  (action) => { if (action.action === 'update_theme') refetchShop() }
)
```

### Get conversation history

```
GET http://localhost:3335/api/user/shop/ai/history
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop/ai/history')
const { messages, summary_memory, entity_memory } = json.result
```

### Reset memory

```
DELETE http://localhost:3335/api/user/shop/ai/memory
Authorization: Bearer <token>
```

---

## 9. AI Customization Unlock Payment

For `ai_custom` shops. The user pays with NGN via Paystack, which gets converted to a stablecoin and credited to their wallet. The shop is then unlocked automatically.

### Step 1 — Initiate the payment

```
POST http://localhost:3335/api/user/shop/customization/pay
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop/customization/pay', {
  method: 'POST',
  body: JSON.stringify({
    amount_naira: 5000,
    target_currency_id: '<stablecoin-currency-uuid>',  // from GET /api/currencies
  }),
})

if (json.error) return showError(json.message)

const { checkout_url, deposit_id, amount_naira, target_currency } = json.result

// Redirect user to Paystack to complete payment
window.location.href = checkout_url
// OR open in a new tab:
window.open(checkout_url, '_blank')
```

### Step 2 — After Paystack payment

The backend handles everything automatically via webhook. The frontend should:

**Option A — Listen for SSE event (recommended):**
```js
// Already set up in your SSE connection
'shop.customization_unlocked': (data) => {
  setCustomizationUnlocked(true)
  // Now show the AI chat panel
}
```

**Option B — Poll the status endpoint:**
```js
async function pollUnlockStatus() {
  const interval = setInterval(async () => {
    const json = await apiFetch('/api/user/shop/customization/status')
    const status = json.result

    if (status.unlocked) {
      clearInterval(interval)
      setCustomizationUnlocked(true)
    }
  }, 3000) // check every 3 seconds

  return interval
}
```

```
GET http://localhost:3335/api/user/shop/customization/status
Authorization: Bearer <token>
```

Response when unlocked:
```json
{
  "shop_id": "uuid",
  "unlocked": true,
  "unlocked_at": "2026-07-11T10:05:00.000Z",
  "latest_deposit": {
    "status": "credited",
    "amount_naira": 5000,
    "credited_amount": 3.14,
    "currency": "USDT"
  }
}
```

Deposit status progression: `pending` → `fiat_received` → `converting` → `credited` (or `failed`)

---

## 10. Product Management

### List products

```
GET http://localhost:3335/api/user/shop/products?page=1&limit=20
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop/products?page=1&limit=20')
const { data: products, meta } = json.result
// meta: { total, per_page, current_page, last_page }
```

### Create product

```
POST http://localhost:3335/api/user/shop/products
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/user/shop/products', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Cool T-Shirt',
    price: 2500,
    description: 'Premium quality shirt',
    category: 'fashion',
    stock: 10,
    track_stock: true,
    variants: null,
  }),
})
const product = json.result
```

### Update product

```
PUT http://localhost:3335/api/user/shop/products/:productId
Authorization: Bearer <token>
```

```js
await apiFetch(`/api/user/shop/products/${product.id}`, {
  method: 'PUT',
  body: JSON.stringify({ price: 3000, stock: 5 }),
})
```

### Delete product (soft delete — sets is_active = false)

```
DELETE http://localhost:3335/api/user/shop/products/:productId
Authorization: Bearer <token>
```

### Upload product images

```
POST http://localhost:3335/api/user/shop/products/:productId/images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

```js
const formData = new FormData()
// Append up to 5 images — all with the field name 'images'
Array.from(files).forEach(file => formData.append('images', file))

const res = await fetch(`${API_URL}/api/user/shop/products/${productId}/images`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
})
const json = await res.json()
const images = json.result.images  // [{ url, publicId }]
```

### Delete a product image

```
DELETE http://localhost:3335/api/user/shop/products/:productId/images/:publicId
Authorization: Bearer <token>
```

> URL-encode the `publicId` before placing it in the path.

```js
await apiFetch(
  `/api/user/shop/products/${productId}/images/${encodeURIComponent(publicId)}`,
  { method: 'DELETE' }
)
```

---

## 11. Payment Links

Payment links are shareable links merchants can send to customers. Each shop has one created automatically.

### List payment links

```
GET http://localhost:3335/api/client/payment-links
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/client/payment-links')
const links = json.result.links
```

### Create a payment link

```
POST http://localhost:3335/api/client/payment-links
Authorization: Bearer <token>
```

```js
const json = await apiFetch('/api/client/payment-links', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Store Checkout',
    fiat_currency: 'NGN',    // optional — if fixed amount
    fiat_amount: 5000,       // optional — if fixed amount
    is_single_use: false,
    usage_limit: 100,
  }),
})
const link = json.result.link
// link.checkout_url = "/api/pay/pl_abc123"
// Full checkout URL: `${API_URL}${link.checkout_url}`
```

---

## 12. Customer Checkout Widget

This is the public-facing payment flow. No auth needed.

### Step 1 — Load checkout page

```
GET http://localhost:3335/api/pay/:slug
```

```js
const res = await fetch(`${API_URL}/api/pay/${slug}`)
const json = await res.json()

if (json.error) {
  // 410 = link expired or inactive
  showMessage('This payment link is no longer active')
  return
}

const { title, fiat_amount, fiat_currency, assets } = json.data
// assets = list of available crypto currencies with amounts
```

### Step 2 — Create checkout session

```
POST http://localhost:3335/api/pay/:slug/checkout
```

```js
const res = await fetch(`${API_URL}/api/pay/${slug}/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fiat_amount: 5000,   // only if link has no fixed amount
    fiat_currency: 'NGN',
  }),
})
const json = await res.json()
const { reference_id, payment_intent_id, assets } = json.data
```

### Step 3 — Customer selects crypto and gets wallet address

```
POST http://localhost:3335/api/pay/:slug/wallet
```

```js
const res = await fetch(`${API_URL}/api/pay/${slug}/wallet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reference_id,           // from step 2
    crypto_currency_id,     // from assets list in step 1 or 2
  }),
})
const json = await res.json()

const { wallet, fiat, crypto } = json.data
// wallet.address   = blockchain address to send to
// wallet.qr_code   = base64 PNG QR code ("data:image/png;base64,...")
// crypto.amount    = exact crypto amount to send
// expiration_time  = seconds until this session expires (1800 = 30 min)
```

Display the wallet address and QR code to the customer. They send the exact crypto amount to that address. The backend confirms automatically.

---

## 13. Complete Endpoint Reference

| Screen / Use Case | Method | Endpoint | Auth |
|---|---|---|---|
| Sign up | POST | `/user/account/signup` | No |
| Login | POST | `/user/account/login` | No |
| Get my shop | GET | `/api/user/shop` | Yes |
| Create shop | POST | `/api/user/shop` | Yes |
| Update shop | PUT | `/api/user/shop` | Yes |
| Upload logo | POST | `/api/user/shop/logo` | Yes |
| Upload banner | POST | `/api/user/shop/banner` | Yes |
| AI chat | POST | `/api/user/shop/ai/chat` | Yes |
| AI streaming chat | POST | `/api/user/shop/ai/chat/stream` | Yes |
| AI history | GET | `/api/user/shop/ai/history` | Yes |
| Reset AI memory | DELETE | `/api/user/shop/ai/memory` | Yes |
| Unlock AI (pay) | POST | `/api/user/shop/customization/pay` | Yes |
| Unlock status | GET | `/api/user/shop/customization/status` | Yes |
| List products | GET | `/api/user/shop/products` | Yes |
| Create product | POST | `/api/user/shop/products` | Yes |
| Update product | PUT | `/api/user/shop/products/:id` | Yes |
| Delete product | DELETE | `/api/user/shop/products/:id` | Yes |
| Upload product images | POST | `/api/user/shop/products/:id/images` | Yes |
| Delete product image | DELETE | `/api/user/shop/products/:id/images/:publicId` | Yes |
| List payment links | GET | `/api/client/payment-links` | Yes |
| Create payment link | POST | `/api/client/payment-links` | Yes |
| Update payment link | PATCH | `/api/client/payment-links/:id` | Yes |
| Delete payment link | DELETE | `/api/client/payment-links/:id` | Yes |
| Real-time events | GET | `/api/user/stream` | Yes |
| **Public storefront data** | GET | `/api/storefront/:subdomain` | **No** |
| Public checkout page | GET | `/api/pay/:slug` | No |
| Create checkout session | POST | `/api/pay/:slug/checkout` | No |
| Get wallet address + QR | POST | `/api/pay/:slug/wallet` | No |

---

## 14. Common Mistakes Checklist

| Mistake | Fix |
|---|---|
| Using `/user/stream` for SSE | Use `/api/user/stream` |
| Reading `response.data` for shop object | Read `response.result` |
| Setting `Content-Type: application/json` on file uploads | Remove it — let browser set it for multipart |
| Calling `localhost:3000` for API requests | Use `localhost:3335` for the backend |
| Frontend `/shop/:subdomain` showing "shop not found" | Fetch from `/api/storefront/:subdomain` on the backend |
| Shop URL showing "unavailable" | Read `shop.result.shop_url` or `shop.result.storefront_url` |
| Trying to use AI chat without payment on `ai_custom` shop | Call `/api/user/shop/customization/pay` first |
| Subdomain URL like `https://store.localhost:3000` | Use path-based URL `http://localhost:3000/shop/store` in dev |

# Frontend Changes — Guest Checkout, Delivery, Promos & Cart

This document covers all frontend-facing changes the frontend developer needs to implement.

---

## 1. Guest Checkout (No Login Required)

Customers can now checkout without signing up. The frontend should support both **guest** and **logged-in** flows.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/cart/checkout` | ❌ No | Create payment intent as guest |
| `POST` | `/api/cart/wallet` | ❌ No | Get wallet address as guest |
| `GET` | `/api/shop/:subdomain/delivery-settings` | ❌ No | Get shop delivery rules |
| `POST` | `/api/user/cart/checkout` | ✅ Yes | Create payment intent (logged-in) |
| `POST` | `/api/user/cart/wallet` | ✅ Yes | Get wallet address (logged-in) |
| `GET` | `/api/user/cart` | ✅ Yes | View logged-in user's cart |

### Guest Checkout Flow

```ts
// Step 1: Customer enters email + delivery address on checkout page
const checkoutPayload = {
  customer_email: "customer@example.com",
  items: [
    {
      product_id: "product-uuid",
      quantity: 2,
      price: 5000,
      shopId: "shop-uuid"
    }
  ],
  fiat_currency: "NGN",
  payment_method: "crypto",
  delivery_address: {
    full_name: "John Doe",
    phone: "08012345678",
    address: "123 Main St",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria"
  },
  delivery_state: "Lagos",
  promo_code: "SAVE10"
}

// Step 2: Call guest checkout
const res = await fetch('/api/cart/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(checkoutPayload)
})
const data = await res.json()

// Response includes totals breakdown:
console.log(data.result)
// {
//   payment_intent_id: "...",
//   reference_id: "...",
//   fiat_amount: 10500,        // <-- final total after delivery + discount
//   fiat_currency: "NGN",
//   items_total: 10000,        // <-- sum of items
//   delivery_fee: 500,         // <-- calculated delivery
//   discount_amount: 0,        // <-- promo/percentage discount
//   delivery_address: { ... },
//   delivery_state: "Lagos",
//   assets: [...]              // crypto options
// }
```

### Guest Wallet Flow

```ts
// Step 3: Customer selects crypto asset
const walletRes = await fetch('/api/cart/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reference_id: data.result.reference_id,
    crypto_currency_id: selectedCurrencyId
  })
})
const walletData = await walletRes.json()

// Response:
console.log(walletData.data)
// {
//   payment_intent_id: "...",
//   reference_id: "...",
//   wallet: {
//     address: "0x...",
//     qr_code: "data:image/png;base64,..."
//   },
//   fiat: { name: "NGN", symbol: "NGN", amount: 10000 },
//   crypto: { name: "USDT", symbol: "USDT", amount: 10000, network: { name: "Ethereum" } }
// }
```

### Important: No Auth Headers for Guest Flow

```ts
// ❌ Do NOT send Authorization header for guest endpoints
fetch('/api/cart/checkout', {
  headers: {
    'Authorization': `Bearer ${token}`,  // <-- Remove this for guest
    'Content-Type': 'application/json'
  }
})

// ✅ Correct for guest
fetch('/api/cart/checkout', {
  headers: {
    'Content-Type': 'application/json'
  }
})
```

---

## 2. Delivery Settings Display

Before showing the checkout form, fetch delivery settings for the shop so you can:
- Show delivery fee
- Show "Free delivery" badge if applicable
- Show promo code field if shop has a promo configured
- Build state/location dropdown from `delivery_zones`

```ts
// Fetch public delivery settings for a shop
const res = await fetch(`/api/shop/${subdomain}/delivery-settings`)
const data = await res.json()

console.log(data.result)
// {
//   has_free_delivery: false,
//   delivery_fee: 500,
//   delivery_zones: { "Lagos": 500, "Abuja": 1000 },
//   discount_percentage: 10,
//   discount_amount: 200,
//   promo_code: "SAVE10",
//   free_delivery_threshold: 15000
// }
```

### Using Delivery Settings in Checkout UI

```tsx
// Example: show delivery fee based on selected state
function getDeliveryFee(settings, selectedState) {
  if (settings.has_free_delivery) return 0
  if (selectedState && settings.delivery_zones?.[selectedState]) {
    return settings.delivery_zones[selectedState]
  }
  return settings.delivery_fee
}

// Example: calculate total in frontend
function calculateTotal(items, settings, selectedState, promoCode) {
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = getDeliveryFee(settings, selectedState)
  
  let discount = 0
  if (promoCode && settings.promo_code && promoCode === settings.promo_code) {
    discount += settings.discount_amount
  }
  if (settings.discount_percentage > 0) {
    discount += (itemsTotal * settings.discount_percentage) / 100
  }
  
  return itemsTotal + deliveryFee - discount
}
```

---

## 3. Guest Cart on Storefront

If a customer adds items to cart as a guest and clicks "View Cart" on `/shop/[subdomain]`, do **not** call `GET /api/user/cart` — that endpoint requires auth and will return 401.

Instead:
- Keep cart items in **localStorage** on the storefront
- When customer clicks "Checkout", send the full items array in the `POST /api/cart/checkout` body
- After successful checkout, clear `localStorage.removeItem('guest_cart')`

```ts
// Example localStorage cart structure
const guestCart = [
  {
    product_id: "uuid",
    name: "Product Name",
    price: 5000,
    quantity: 2,
    image: "https://...",
    shopId: "shop-uuid",
    stock: 100,
    is_active: true
  }
]
localStorage.setItem('guest_cart', JSON.stringify(guestCart))
```

---

## 4. Checkout Page Changes

### Step 1: Customer Details + Cart Review

Show:
- Cart items with quantities and prices
- `items_total` (sum of products)
- Delivery address form
- State/location selector (if `delivery_zones` exists)
- Promo code input (if `promo_code` is set on shop)

### Step 2: Payment

After customer enters details and clicks "Pay":
1. Call `POST /api/cart/checkout` with full payload including `delivery_address`, `delivery_state`, `promo_code`
2. Show `fiat_amount` as the total to pay
3. If `payment_method === 'crypto'`, show asset dropdown with `assets` array
4. When customer selects asset, call `POST /api/cart/wallet` with `reference_id` + `crypto_currency_id`
5. Show wallet address + QR code
6. Show timer/expiration info

### Step 3: Confirmation

After payment is confirmed (via SSE or polling):
- Clear `localStorage.guest_cart`
- Redirect to `/checkout/success?reference_id=...`
- Show order confirmation

---

## 5. Storefront Product Page Changes

### Add to Cart Button

```tsx
// On /shop/[subdomain] product listing
<button onClick={() => addToCart(product)}>
  Add to Cart — ₦{product.price}
</button>
```

```ts
// addToCart should:
// 1. Add to localStorage guest_cart
// 2. Emit cart event for other tabs
// 3. Show updated cart count

function addToCart(product) {
  const cart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
  const existing = cart.find(item => item.product_id === product.id)
  
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images?.[0]?.url,
      shopId: product.shop_id,
      stock: product.stock,
      is_active: product.isActive
    })
  }
  
  localStorage.setItem('guest_cart', JSON.stringify(cart))
  updateCartCount()
}
```

### Cart Icon / Drawer

Show cart count badge. On click, open cart drawer showing:
- Product name, price, quantity
- Remove button per item
- Subtotal
- "Proceed to Checkout" button → `/checkout`

---

## 6. Logged-In User Cart

If user is logged in (has auth token), use the existing authenticated endpoints:

```ts
// Add to cart
POST /api/user/cart/items
Authorization: Bearer <token>
Body: { product_id, quantity }

// View cart
GET /api/user/cart
Authorization: Bearer <token>

// Checkout
POST /api/user/cart/checkout
Authorization: Bearer <token>
Body: { fiat_currency?, payment_method?, delivery_address?, delivery_state?, promo_code? }
```

---

## 7. SSE Events for Cart

Connect to `GET /api/user/stream` (logged-in users only) to sync cart across tabs:

| Event | Description |
|---|---|
| `cart.item_added` | Product added to cart |
| `cart.item_removed` | Product removed from cart |
| `cart.updated` | Cart item quantity updated |
| `cart.cleared` | All items cleared |
| `cart.checkout_completed` | Payment intent created |
| `order.payment_received` | Payment confirmed |

Guests do not have SSE access — they rely on localStorage + polling if needed.

---

## 8. Next.js Proxy Routes

Create these API routes in your Next.js app:

### `app/api/cart/checkout/route.ts`
```ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
```

### `app/api/cart/wallet/route.ts`
```ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart/wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
```

### `app/api/shop/[subdomain]/delivery-settings/route.ts`
```ts
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { subdomain: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shop/${params.subdomain}/delivery-settings`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
```

---

## 9. Environment Variables

Make sure your Next.js app has:

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## 10. Complete Checkout Flow Diagram

### Guest Flow
```
Customer browses /shop/:subdomain
    ↓
Adds items → stored in localStorage
    ↓
Clicks "Checkout"
    ↓
Fills delivery address + email
    ↓
POST /api/shop/:subdomain/delivery-settings (get delivery rules)
    ↓
POST /backend/api/cart/checkout
Body: { customer_email, items: [...], delivery_address, delivery_state, promo_code }
    ↓
Returns: reference_id, fiat_amount (with delivery + discount), assets
    ↓
Customer selects crypto asset
    ↓
POST /backend/api/cart/wallet
Body: { reference_id, crypto_currency_id }
    ↓
Returns: wallet address + QR
    ↓
Customer sends crypto
    ↓
Payment confirmed via webhook/polling
    ↓
Email sent to customer: order confirmed
    ↓
Clear localStorage.guest_cart
    ↓
Redirect to /checkout/success
```

### Logged-In Flow
```
Customer adds items → saved to DB cart
    ↓
Clicks "Checkout"
    ↓
GET /api/user/cart (view cart)
    ↓
Fills delivery address on checkout page
POST /api/user/cart/checkout
Body: { delivery_address, delivery_state, promo_code }
    ↓
Returns: reference_id, fiat_amount (with delivery + discount), assets
    ↓
Customer selects crypto asset
POST /api/user/cart/wallet
    ↓
Returns: wallet address + QR
    ↓
Customer sends crypto
    ↓
Payment confirmed
    ↓
Email sent to customer: order confirmed
```

---

## 11. Response Shapes

### Guest Checkout Response
```json
{
  "error": false,
  "data": "Checkout session created",
  "result": {
    "payment_intent_id": "uuid",
    "reference_id": "uuid",
    "fiat_amount": 10500,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 2,
    "items_total": 10000,
    "delivery_fee": 500,
    "discount_amount": 0,
    "delivery_address": { "full_name": "...", "phone": "...", "address": "...", "city": "...", "state": "...", "country": "..." },
    "delivery_state": "Lagos",
    "assets": [
      {
        "currency_id": "uuid",
        "name": "USDT",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "Ethereum", "logo": "https://..." },
        "amount": 10500
      }
    ]
  }
}
```

### Guest Wallet Response
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "uuid",
    "reference_id": "uuid",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "0x...",
      "qr_code": "data:image/png;base64,..."
    },
    "fiat": { "name": "NGN", "symbol": "NGN", "amount": 10500 },
    "crypto": { "name": "USDT", "symbol": "USDT", "amount": 10500, "network": { "name": "Ethereum" } }
  },
  "message": "Payment initiated successfully"
}
```

### Delivery Settings Response
```json
{
  "error": false,
  "data": "Delivery settings retrieved",
  "result": {
    "id": "uuid",
    "shop_id": "shop-uuid",
    "has_free_delivery": false,
    "delivery_fee": 500,
    "delivery_zones": { "Lagos": 500, "Abuja": 1000 },
    "discount_percentage": 10,
    "discount_amount": 200,
    "promo_code": "SAVE10",
    "free_delivery_threshold": 15000
  }
}
```

### Logged-In Cart View Response
```json
{
  "error": false,
  "data": "Cart retrieved",
  "result": {
    "cart_id": "uuid",
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 5000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://...",
        "stock": 100,
        "is_active": true,
        "shop_id": "shop-uuid"
      }
    ],
    "total": 10000,
    "currency": "NGN",
    "item_count": 1
  }
}
```

---

## 12. What Changed for Customers

| Feature | Before | Now |
|---|---|---|
| Checkout | Required login | Guest checkout available |
| Delivery | Not supported | Address + delivery fee per state |
| Discounts | Not supported | Promo codes + percentage discounts |
| Cart | DB-only (auth required) | localStorage for guests |
| Payment confirmation email | Business only | Customer also receives confirmation |

---

## 13. What Changed for Shop Owners

| Feature | Before | Now |
|---|---|---|
| Delivery pricing | Not configurable | Per-shop delivery settings |
| Delivery zones | Not supported | State-based delivery fees |
| Free delivery | Not supported | Toggle + threshold |
| Promos | Not supported | Promo codes + percentage/fixed discounts |
| Discounts | Not supported | Applied at checkout |

---

## Notes

- All guest checkout requests are **public** — no auth headers
- The `POST /api/cart/checkout` guest endpoint accepts items directly in the body, not from DB cart
- Delivery settings are fetched once when the storefront loads, then cached client-side
- Promo validation happens on the backend — never trust frontend promo calculations
- After payment confirmation, the customer receives `customer_order_confirmed.html` email

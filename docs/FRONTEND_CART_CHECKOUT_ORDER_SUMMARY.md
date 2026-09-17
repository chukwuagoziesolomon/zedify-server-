# Frontend Cart, Checkout & Order Summary API

**Date:** 2026-09-17  
**Scope:** Existing endpoints for cart, checkout, and orders; plus the missing order-summary/checkout-confirmation endpoint that still needs to be created.

---

## 1. Existing Endpoints

### 1.1 Cart — Authenticated User

**`GET /api/user/cart`**  
Returns the current user's cart with items and totals.

**Response:**

```json
{
  "success": true,
  "data": {
    "cart_id": "cart-uuid",
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 1000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://...",
        "stock": 50,
        "is_active": true,
        "shop_id": "shop-uuid"
      }
    ],
    "total": 2000,
    "currency": "NGN",
    "item_count": 2
  }
}
```

### 1.2 Cart — Guest (No Auth)

**`GET /api/cart?guest_token=xxx`**  
Same shape as authenticated cart, identified by `guest_token`.

### 1.3 Checkout — Authenticated

**`POST /api/user/cart/checkout`**  
Creates a `PaymentIntent` from cart items.

**Body:**

```json
{
  "fiat_currency": "NGN",
  "payment_method": "crypto",
  "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
  "delivery_state": "Lagos",
  "promo_code": "SAVE10"
}
```

**Response (crypto):**

```json
{
  "success": true,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "fiat_amount": 5000,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 3,
    "items_total": 4500,
    "delivery_fee": 500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_local": 500,
    "delivery_fee_local_currency": "NGN",
    "discount_amount": 0,
    "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
    "delivery_state": "Lagos",
    "assets": [
      {
        "currency_id": "currency-uuid",
        "name": "Tether",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "BSC", "logo": "https://..." },
        "amount": 50.0
      }
    ],
    "items": [
      {
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 1000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://...",
        "shop_id": "shop-uuid"
      }
    ]
  }
}
```

**Response (paystack):**

```json
{
  "success": true,
  "data": {
    "payment_method": "paystack",
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "authorization_url": "https://checkout.paystack.com/...",
    "fiat_amount": 5000,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 3,
    "items_total": 4500,
    "delivery_fee": 500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_local": 500,
    "delivery_fee_local_currency": "NGN",
    "discount_amount": 0,
    "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
    "delivery_state": "Lagos"
  }
}
```

### 1.4 Get Wallet for Checkout

**`POST /api/user/cart/wallet`**  
After checkout, when the user selects a crypto asset, this returns the deposit wallet.

**Body:**

```json
{
  "payment_intent_id": "intent-uuid",
  "crypto_currency_id": "currency-uuid"
}
```

**Response:**

```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "0x...",
      "qr_code": "data:image/png;base64,...",
      "network": "BSC",
      "currency": "USDT"
    },
    "fiat": {
      "amount": 5000,
      "currency": "NGN"
    },
    "crypto": {
      "amount": 50.0,
      "currency": "USDT",
      "network": "BSC"
    }
  }
}
```

### 1.5 Guest Checkout

**`POST /api/cart/checkout`**  
Same as authenticated checkout but no auth required.

**Body:**

```json
{
  "customer_email": "customer@example.com",
  "items": [
    { "product_id": "product-uuid", "quantity": 2 }
  ],
  "fiat_currency": "NGN",
  "payment_method": "crypto",
  "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
  "delivery_state": "Lagos",
  "promo_code": "SAVE10"
}
```

Response shape is identical to authenticated checkout.

### 1.6 Guest Wallet

**`POST /api/cart/wallet`**  
Same as authenticated wallet creation, but uses `reference_id` instead of `payment_intent_id`.

**Body:**

```json
{
  "reference_id": "ref-uuid",
  "crypto_currency_id": "currency-uuid"
}
```

### 1.7 Shop Orders — List

**`GET /api/user/shop/orders?shop_id=xxx&status=pending&page=1&limit=20`**  
Returns paginated orders for the shop.

**Response:**

```json
{
  "success": true,
  "data": {
    "meta": { "total": 10, "per_page": 20, "current_page": 1, "last_page": 1 },
    "data": [
      {
        "id": "intent-uuid",
        "reference_id": "ref-uuid",
        "payment_status": "payment_confirmed",
        "order_status": "processing",
        "amount": 5000,
        "currency": "NGN",
        "customer": { "id": "customer-uuid", "email": "customer@example.com", "phone": "08012345678" },
        "items": [{ "product_id": "...", "name": "...", "quantity": 2, "price": 1000 }],
        "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
        "delivery_state": "Lagos",
        "created_at": "2026-09-17T10:00:00.000Z",
        "paid_at": "2026-09-17T10:05:00.000Z",
        "updated_at": "2026-09-17T10:05:00.000Z"
      }
    ]
  }
}
```

### 1.8 Shop Orders — Single Order

**`GET /api/user/shop/orders/:orderId?shop_id=xxx`**  
Returns one order in the same shape as the list item above.

### 1.9 Update Order Status

**`PATCH /api/user/shop/orders/:orderId/status?shop_id=xxx`**  
**Body:** `{ "status": "pending|processing|shipped|delivered|cancelled" }`

### 1.10 Payment Intent History

**`GET /api/user/payment-intent/history?page=1&limit=20&status=payment_confirmed`**  
Returns paginated payment intents with enriched currency/network/wallet info.

**Response:**

```json
{
  "success": true,
  "data": {
    "meta": { "total": 50, "per_page": 20, "current_page": 1, "last_page": 3 },
    "transactions": [
      {
        "transaction_id": "intent-uuid",
        "reference_id": "ref-uuid",
        "amount": 5000,
        "currency": { "id": "curr-uuid", "name": "Nigerian Naira", "symbol": "NGN", "logo": null },
        "status": "payment_confirmed",
        "created_at": "2026-09-17T10:00:00.000Z",
        "completed_at": "2026-09-17T10:05:00.000Z",
        "wallet": { "id": "wal-uuid", "address": "0x...", "qr_code": null, "status": "active" },
        "crypto": { "id": "curr-uuid", "name": "Tether", "symbol": "USDT", "logo": null, "contract_address": null },
        "network": { "id": "net-uuid", "name": "BSC", "logo": null, "is_testnet": false }
      }
    ]
  }
}
```

### 1.11 Public Payment Link Checkout

**`POST /api/pay/:slug/checkout`**  
Creates a payment intent from a public payment link.

**Body:**

```json
{
  "customer_email": "customer@example.com",
  "fiat_amount": 5000,
  "fiat_currency": "NGN"
}
```

**`POST /api/pay/:slug/wallet`**  
Returns deposit wallet for a payment link.

**Body:**

```json
{
  "crypto_currency_id": "currency-uuid"
}
```

---

## 2. Missing Endpoint — Order Summary / Checkout Confirmation

### 2.1 Problem

After the frontend calls `/api/user/cart/checkout` or `/api/cart/checkout`, it gets a `reference_id` and `payment_intent_id`. But there is **no endpoint** to:

- Retrieve the full order summary by `reference_id` or `payment_intent_id`
- Poll for payment status updates on the order/checkout page
- Get a unified order confirmation view after payment succeeds

Currently the frontend has to either:
- Hold the checkout response in memory, or
- Use the transaction history endpoint and filter by `reference_id`

### 2.2 Required Endpoint

**`GET /api/user/checkout/:referenceIdOrIntentId`**  
or  
**`GET /api/user/orders/:orderId`**

This should return the full order/checkout details, including:

```json
{
  "success": true,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "status": "payment_confirmed",
    "order_status": "processing",
    "fiat_amount": 5000,
    "fiat_currency": "NGN",
    "items_total": 4500,
    "delivery_fee": 500,
    "delivery_fee_currency": "NGN",
    "discount_amount": 0,
    "total_amount": 5000,
    "payment_method": "crypto",
    "shop_id": "shop-uuid",
    "shop_name": "My Shop",
    "items": [
      {
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 1000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://...",
        "shop_id": "shop-uuid"
      }
    ],
    "delivery_address": { "phone": "08012345678", "address": "123 Main St" },
    "delivery_state": "Lagos",
    "customer": {
      "email": "customer@example.com",
      "phone": "08012345678"
    },
    "wallet": {
      "address": "0x...",
      "qr_code": "data:image/png;base64,...",
      "network": "BSC",
      "currency": "USDT",
      "amount": 50.0
    },
    "timeline": [
      { "event": "created", "timestamp": "2026-09-17T10:00:00.000Z" },
      { "event": "payment_confirmed", "timestamp": "2026-09-17T10:05:00.000Z" },
      { "event": "order_processing", "timestamp": "2026-09-17T10:10:00.000Z" }
    ],
    "created_at": "2026-09-17T10:00:00.000Z",
    "paid_at": "2026-09-17T10:05:00.000Z",
    "updated_at": "2026-09-17T10:10:00.000Z"
  }
}
```

### 2.3 Backend Implementation Needed

A new controller method or dedicated `CheckoutController` with:

1. **Lookup** by `reference_id` or `payment_intent_id` (`uniqueId`)
2. **Enrichment** of:
   - Shop name
   - Customer info
   - Wallet details if crypto payment
   - Payment timeline from `PaymentIntent` status history
3. **Authorization** — ensure the user can only view their own orders/shop orders

### 2.4 Public Order Status (No Auth)

For guest checkout, a public endpoint is also useful:

**`GET /api/checkout/status/:referenceId`**

```json
{
  "success": true,
  "data": {
    "reference_id": "ref-uuid",
    "status": "awaiting_payment",
    "fiat_amount": 5000,
    "fiat_currency": "NGN",
    "items_count": 3,
    "wallet": {
      "address": "0x...",
      "network": "BSC",
      "currency": "USDT",
      "amount": 50.0
    },
    "expires_at": "2026-09-17T10:30:00.000Z"
  }
}
```

This allows guests to bookmark the checkout page and poll for payment confirmation.

---

## 3. Frontend Pages to Build

### 3.1 Cart Page

**Route:** `/cart`  
**Data source:** `GET /api/user/cart` or `GET /api/cart?guest_token=xxx`

Display:
- Product list with image, name, price, quantity, line total
- Cart total
- Checkout button

### 3.2 Checkout Page

**Route:** `/checkout`  
**Actions:**
1. Load cart
2. Show order summary: items, subtotal, delivery fee, discount, total
3. Collect delivery address and state
4. Select payment method: crypto or Paystack
5. Submit to `POST /api/user/cart/checkout`

### 3.3 Order Confirmation / Payment Page

**Route:** `/checkout/confirm/:referenceId`  
**Data source:** `GET /api/user/checkout/:referenceId` (to be created)

Display:
- Order status badge
- Items summary
- Payment details (wallet address / Paystack link)
- Timer countdown if crypto payment
- Timeline of events

### 3.4 Order History

**Route:** `/orders`  
**Data source:** `GET /api/user/payment-intent/history`

Display:
- List of past orders with status, amount, date
- Click to view detail

### 3.5 Shop Orders (Merchant)

**Route:** `/dashboard/shop/orders`  
**Data source:** `GET /api/user/shop/orders?shop_id=xxx`

Display:
- Order list with customer, items, amount, status
- Status update dropdown
- Order detail view with messages

---

## 4. Relevant Backend Files

- `app/Controllers/Http/CartController.ts` — cart + checkout
- `app/Controllers/Http/PaymentIntentController.ts` — payment intent creation + history
- `app/Controllers/Http/ShopOrderController.ts` — shop order listing + status updates
- `routes/user/cart.ts` — cart routes
- `routes/user/payment_intent.ts` — payment intent routes
- `routes/user/shop_builder.ts` — shop order routes
- `routes/public.ts` — public payment link checkout + guest cart

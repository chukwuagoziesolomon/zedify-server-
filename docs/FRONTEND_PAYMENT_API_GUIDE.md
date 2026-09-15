# Frontend Payment API Guide

This document is the frontend handoff for the current payment and checkout flow. It contains the recommended architecture, endpoint contracts, payloads, responses, and error handling.

## 1) Recommended payment architecture

### Recommendation
Use a split architecture instead of trying to force one wallet connector to work for every blockchain:

- CKB / CCC: only for CKB and Fiber payment flows
- Paystack: for fiat payments (card, bank transfer, USSD, and other supported Paystack channels)
- Other crypto chains: use their own dedicated wallet/chain payment flow
- Payment confirmation: only trigger success states after actual confirmation from the payment indexer / webhook pipeline

### Why this is the correct approach
- CCC is a CKB-compatible wallet/auth flow, not a universal cross-chain wallet connector
- Fiber/CKB transactions use a different flow than generic EVM wallet transfers
- Mixing everything into one generic connector creates fragile logic and false success states
- The backend is already structured for this split model and it is the safest production design

### Frontend interpretation
The frontend should handle payment methods like this:

- If the user picks Paystack: use the Paystack checkout URL returned by the backend
- If the user picks crypto: show the available assets and let the user select one
- If the user picks CKB/Fiber: use the CKB/Fiber wallet or invoice flow returned by the backend
- On successful confirmation, subscribe to SSE or poll status using the payment intent reference

---

## 2) Payment flow overview

### A. Merchant payment link flow
Used for public checkout pages and merchant payment links.

1. Frontend calls GET /api/pay/:slug
2. Backend returns the payment link metadata and available asset list
3. Frontend calls POST /api/pay/:slug/checkout or selected wallet flow
4. Backend creates payment intent / setup / wallet address
5. Frontend redirects or presents wallet/payment instructions
6. Backend confirms payment via webhook/indexer and pushes status updates

### B. Cart checkout flow
Used for user or guest cart checkout.

1. Frontend calls POST /api/user/cart/checkout or POST /api/cart/checkout
2. Backend returns a created payment intent + asset options
3. Frontend calls POST /api/user/cart/wallet with payment_intent_id and crypto_currency_id
4. Backend returns wallet details and payment instructions
5. Frontend waits for payment confirmation and then shows success

### C. Direct payment intent flow
Used by merchant dashboard or custom checkout flows.

1. POST /api/user/payment-intent
2. Backend creates a payment intent and returns available assets
3. POST /api/user/payment-intent/create-wallet with reference_id and crypto_currency_id
4. Backend returns wallet/invoice details

---

## 3) Response conventions

### Standard success response
```json
{
  "error": false,
  "data": "Payment intent created successfully",
  "code": 200,
  "result": {
    "reference_id": "abc123",
    "amount": 5000
  }
}
```

### Public checkout response
```json
{
  "error": false,
  "data": {
    "slug": "abc123",
    "title": "Product checkout",
    "assets": []
  }
}
```

### Standard error response
```json
{
  "error": true,
  "data": "Invalid crypto currency",
  "details": "Invalid crypto currency",
  "code": 400
}
```

### Auth error
```json
{
  "error": true,
  "data": "Unauthorized access. Please sign in again.",
  "details": "...",
  "code": 401
}
```

---

## 4) Public payment link endpoints

### 4.1 Get payment link details
Endpoint:
```http
GET /api/pay/:slug
```

Purpose:
- Returns merchant link details
- Returns available crypto assets for checkout
- Used to render public payment page

Example request:
```http
GET /api/pay/abc123
```

Example success response:
```json
{
  "error": false,
  "data": {
    "slug": "abc123",
    "title": "BitGadgetz Checkout",
    "description": "Pay for your order",
    "fiat_amount": 45000,
    "fiat_currency": {
      "symbol": "NGN",
      "name": "Nigerian Naira"
    },
    "is_fixed_amount": true,
    "assets": [
      {
        "currency_id": "cur_123",
        "name": "USDT Tether",
        "symbol": "USDT",
        "logo": "https://.../usdt-logo.svg",
        "network": {
          "name": "Binance Smart Chain",
          "logo": "https://.../bnb-logo.png"
        },
        "amount": 12.5
      },
      {
        "currency_id": "cur_456",
        "name": "Nervos CKB",
        "symbol": "CKB",
        "logo": "https://.../ckb-logo.svg",
        "network": {
          "name": "Nervos CKB Mainnet",
          "logo": "https://.../ckb-logo.png"
        },
        "amount": 24.75
      }
    ]
  }
}
```

Possible errors:
```json
{
  "error": true,
  "message": "Payment link not found"
}
```

```json
{
  "error": true,
  "message": "This payment link is no longer active"
}
```

### 4.2 Create checkout session from payment link
Endpoint:
```http
POST /api/pay/:slug/checkout
```

Body:
```json
{
  "fiat_amount": 45000
}
```

Notes:
- Only required when the link does not have a fixed amount
- Returns a payment intent reference and available assets

Example success response:
```json
{
  "error": false,
  "data": {
    "reference_id": "ref_123",
    "fiat_amount": 45000,
    "fiat_currency": "NGN",
    "assets": [
      {
        "currency_id": "cur_123",
        "name": "USDT Tether",
        "symbol": "USDT",
        "network": {
          "name": "Binance Smart Chain",
          "logo": "..."
        },
        "amount": 12.5
      }
    ]
  },
  "code": 200
}
```

### 4.3 Create wallet / invoice for selected crypto
Endpoint:
```http
POST /api/pay/:slug/wallet
```

Body:
```json
{
  "payment_intent_id": "intent_123",
  "crypto_currency_id": "cur_456"
}
```

Example success response:
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent_123",
    "reference_id": "ref_123",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "ckt1...",
      "qr_code": "https://.../qr.png"
    },
    "fiat": {
      "amount": 45000,
      "currency": "NGN"
    },
    "crypto": {
      "symbol": "CKB",
      "name": "Nervos CKB",
      "network": "Nervos CKB Mainnet"
    }
  },
  "message": "Fiber invoice created successfully"
}
```

Notes:
- If the selected asset uses a Fiber invoice route, the response may include a Fiber-style wallet address/invoice payload
- For normal wallet flows, it returns a wallet address and QR code

---

## 5) Cart checkout endpoints

### 5.1 Authenticated cart checkout
Endpoint:
```http
POST /api/user/cart/checkout
```

Authentication:
```http
Authorization: Bearer <user_token>
```

Body:
```json
{
  "fiat_currency": "NGN",
  "payment_method": "crypto",
  "delivery_address": {
    "full_name": "Jane Doe",
    "phone": "+2348012345678",
    "address": "12 Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "NG"
  },
  "delivery_state": "Lagos",
  "promo_code": "WELCOME10"
}
```

Example success response:
```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 200,
  "result": {
    "payment_intent_id": "intent_123",
    "reference_id": "ref_123",
    "fiat_amount": 75000,
    "fiat_currency": "NGN",
    "shop_id": "shop_123",
    "items_count": 2,
    "items_total": 70000,
    "delivery_fee": 5000,
    "discount_amount": 0,
    "assets": [
      {
        "currency_id": "cur_1",
        "name": "USDT Tether",
        "symbol": "USDT",
        "logo": "https://...",
        "network": {
          "name": "Binance Smart Chain",
          "logo": "https://..."
        },
        "amount": 18.5
      }
    ]
  }
}
```

### 5.2 Paystack checkout from cart
When `payment_method` is `paystack`, the backend responds with an authorization URL:

```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 200,
  "result": {
    "payment_method": "paystack",
    "payment_intent_id": "intent_123",
    "reference_id": "ref_123",
    "authorization_url": "https://checkout.paystack.com/....",
    "fiat_amount": 75000,
    "fiat_currency": "NGN"
  }
}
```

Frontend action:
- Redirect the user to `authorization_url`
- Once Paystack confirms the payment, the backend will update status and emit notification events

### 5.3 Get wallet for a selected asset in cart checkout
Endpoint:
```http
POST /api/user/cart/wallet
```

Body:
```json
{
  "payment_intent_id": "intent_123",
  "crypto_currency_id": "cur_456"
}
```

Example success response:
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent_123",
    "reference_id": "ref_123",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "0xabc...",
      "qr_code": "https://.../qr.png"
    },
    "fiat": {
      "amount": 75000,
      "currency": "NGN"
    },
    "crypto": {
      "symbol": "USDT",
      "name": "USDT Tether",
      "network": "Binance Smart Chain"
    }
  },
  "message": "Payment initiated successfully"
}
```

### 5.4 Guest checkout
Endpoint:
```http
POST /api/cart/checkout
```

Body:
```json
{
  "customer_email": "customer@example.com",
  "items": [
    {
      "product_id": "prod_1",
      "quantity": 1,
      "price": 25000,
      "shopId": "shop_123"
    }
  ],
  "fiat_currency": "NGN",
  "payment_method": "crypto",
  "delivery_address": {
    "full_name": "Jane Doe",
    "phone": "+2348012345678",
    "address": "12 Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "NG"
  },
  "delivery_state": "Lagos",
  "promo_code": "WELCOME10"
}
```

---

## 6) Direct payment intent endpoints

### 6.1 Create payment intent
Endpoint:
```http
POST /api/user/payment-intent
```

Authentication required.

Body:
```json
{
  "fiat_amount": 1000,
  "fiat_currency": "NGN",
  "reference_id": "t_cc2c04180"
}
```

Example success response:
```json
{
  "error": false,
  "data": "Payment intent created successfully",
  "code": 200,
  "result": {
    "fiat_amount": 1000,
    "fiat_currency": "NGN",
    "reference_id": "t_cc2c04180",
    "assets": [
      {
        "currency_id": "cur_123",
        "name": "USDT Tether",
        "symbol": "USDT",
        "logo": "https://...",
        "network": {
          "name": "Binance Smart Chain",
          "logo": "https://..."
        },
        "amount": 0.32
      }
    ]
  }
}
```

Common validation errors:
```json
{
  "error": true,
  "data": "Reference ID already used",
  "details": "Reference ID already used",
  "code": 400
}
```

```json
{
  "error": true,
  "data": "Invalid fiat currency",
  "details": "Invalid fiat currency",
  "code": 400
}
```

### 6.2 Create wallet for selected payment intent asset
Endpoint:
```http
POST /api/user/payment-intent/create-wallet
```

Body:
```json
{
  "crypto_currency_id": "cur_456",
  "reference_id": "t_cc2c04180"
}
```

Example success response:
```json
{
  "error": false,
  "data": {
    "reference_id": "t_cc2c04180",
    "expiration_time": "1800",
    "payment_intent_id": "intent_123",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "fib1...",
      "qr_code": "https://..."
    },
    "fiat": {
      "amount": 1000,
      "currency": "NGN"
    },
    "crypto": {
      "symbol": "CKB",
      "name": "Nervos CKB",
      "network": "Nervos CKB Mainnet"
    }
  },
  "message": "Fiber invoice created successfully"
}
```

---

## 7) CCC auth endpoints

These are used for CCC wallet authentication and linking, not for arbitrary cross-chain wallet support.

### 7.1 Create challenge
Endpoint:
```http
POST /api/user/auth/ccc/challenge
```

### 7.2 Verify challenge
Endpoint:
```http
POST /api/user/auth/ccc/verify
```

### 7.3 Link wallet to user
Endpoint:
```http
POST /api/user/auth/ccc/link
```

Authentication required.

### 7.4 Unlink wallet
Endpoint:
```http
DELETE /api/user/auth/ccc/link
```

Authentication required.

Important note:
- CCC is for CKB/CCC-based wallet identity validation and CKB/Fiber flows
- It should not be used as a universal wallet provider for every other blockchain

---

## 8) Payment confirmation and notifications

### Webhook route for Paystack
```http
POST /api/webhooks/paystack/deposit
```

Purpose:
- Receives Paystack deposit/charge event callbacks
- Validates the signature and updates the payment intent status
- Triggers confirmation logic, notifications, and settlement steps

### Backend confirmation rule
A payment is considered confirmed only after the backend receives and verifies the payment confirmation event, not simply after the user clicks a payment button.

### After confirmation
The backend typically:
- marks the payment intent as paid/confirmed
- updates order status
- credits wallet or settlement balance
- sends customer/admin notifications
- emits SSE updates to the frontend

---

## 9) Frontend implementation notes

### Recommended status handling
Frontend should expect these states:
- `payment_created`
- `payment_in_progress`
- `paid`
- `confirmed`
- `failed`
- `cancelled`

### Recommended UX flow
1. Render payment assets based on GET /api/pay/:slug or checkout response
2. Let user select fiat or crypto method
3. If Paystack: redirect to `authorization_url`
4. If crypto: get wallet details via the wallet endpoint
5. Poll or subscribe to payment update events until confirmed
6. Show success screen only after confirmation event

### Recommended network guidance
- For CKB/Fiber choices, do not display other chain wallets as if they are interchangeable
- Keep CKB-specific elements separate from EVM/solana/tron entries

---

## 10) Error messages frontend should handle

Common backend messages:

```json
{ "error": true, "data": "Payment link not found", "code": 404 }
```

```json
{ "error": true, "data": "This payment link is no longer active", "code": 410 }
```

```json
{ "error": true, "data": "Invalid crypto currency", "code": 400 }
```

```json
{ "error": true, "data": "Payment intent not found", "code": 400 }
```

```json
{ "error": true, "data": "Your cart is empty.", "code": 400 }
```

```json
{ "error": true, "data": "Checkout is limited to one shop at a time.", "code": 400 }
```

```json
{ "error": true, "data": "Unauthorized access. Please sign in again.", "code": 401 }
```

---

## 11) Final recommendation to frontend team

Use the backend exactly as follows:
- `Paystack` for fiat checkout and card/bank/USSD payment flows
- `Crypto asset list` for wallet-based payments by network
- `CKB / Fiber` only for CKB-native payment flows
- `CCC` only as a CKB/CCC wallet/auth mechanism, not as a general wallet for every chain

This gives the cleanest, most production-safe flow and matches the backend architecture already implemented.

---

## 12) Business wallet provisioning

### Provision a custodial CKB wallet
```http
POST /api/user/wallet/provision
Authorization: Bearer <user_token>
Content-Type: application/json
```

Request body:
```json
{
  "currency_id": "ckb_currency_unique_id"
}
```

The endpoint is idempotent for the authenticated business and CKB network. It
returns the existing active wallet when one has already been provisioned.
Private keys are encrypted at rest and are never returned to the frontend.

Success response:
```json
{
  "error": false,
  "data": "Business wallet provisioned",
  "code": 200,
  "result": {
    "wallet_id": "wallet_123",
    "wallet_address": "ckt1...",
    "network": "Nervos CKB Testnet",
    "network_unique_id": "network_123",
    "currency": "CKB",
    "currency_unique_id": "ckb_currency_unique_id",
    "custody_status": "custodial",
    "status": "active"
  }
}
```

Possible errors:
```json
{ "error": true, "data": "currency_id is required", "code": 400 }
```

```json
{ "error": true, "data": "Business wallet provisioning currently supports CKB currencies only", "code": 400 }
```

```json
{ "error": true, "data": "CKB network mismatch. Backend is configured for testnet", "code": 400 }
```

```json
{ "error": true, "data": "APP_KEY must be configured before custodial wallets can be provisioned", "code": 400 }
```

After provisioning, completed-payment reconciliation can credit the wallet:
```bash
node ace payments:reconcile-completed --include-fiber --apply
```

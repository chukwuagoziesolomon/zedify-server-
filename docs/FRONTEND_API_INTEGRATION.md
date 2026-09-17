# Frontend API Integration Contract

This document maps every backend endpoint to its frontend integration point, exact request payload, success response, and error behavior. Use this as the single source of truth for frontend integration.

---

## Table of Contents

1. [Guest Cart](#1-guest-cart)
2. [Authenticated Cart](#2-authenticated-cart)
3. [Checkout](#3-checkout)
4. [Products](#4-products)
5. [Wallets & Balances](#5-wallets--balances)
6. [Withdrawals](#6-withdrawals)
7. [Transaction History](#7-transaction-history)
8. [Available Assets](#8-available-assets)
9. [SSE Events](#9-sse-events)
10. [Delivery Settings](#10-delivery-settings)
11. [Orders](#11-orders)
12. [Error Handling](#12-error-handling)

---

## 1. Guest Cart

### 1.1 Add Item to Guest Cart

**Integration point:** Product listing page, product detail page — "Add to Cart" button for unauthenticated users.

**Endpoint:** `POST /api/cart/items`  
**Auth:** None

**Request payload:**
```json
{
  "product_id": "string (required) — product uniqueId",
  "quantity": "number (optional, default: 1) — must be >= 1",
  "guest_token": "string (optional) — omit on first call, include on subsequent calls"
}
```

**Success response (201):**
```json
{
  "error": false,
  "data": null,
  "message": "Item added to cart",
  "result": {
    "guest_token": "generated-token-here",
    "cart_id": "cart-uuid"
  }
}
```

**Frontend action:** Store `result.guest_token` in `localStorage` or cookie. Include it as `?guest_token=<token>` on all subsequent guest cart requests.

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `product_id is required.` | Missing `product_id` |
| 400 | `quantity must be at least 1.` | `quantity < 1` |
| 404 | `ShopProduct does not exist` | Invalid `product_id` |
| 400 | `Product is not active.` | Product `isActive = false` |
| 400 | `Requested quantity exceeds available stock.` | `quantity > product.stock` |

---

### 1.2 View Guest Cart

**Integration point:** Cart icon / cart page for unauthenticated users.

**Endpoint:** `GET /api/cart?guest_token=<token>`  
**Auth:** None

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "cart_id": "cart-uuid",
    "items": [
      {
        "id": "item-uuid",
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 5000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://res.cloudinary.com/...",
        "stock": 10,
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

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `guest_token is required` | Missing `guest_token` query param |

---

### 1.3 Update Guest Cart Item

**Integration point:** Cart page quantity controls for unauthenticated users.

**Endpoint:** `PUT /api/cart/items/:itemId?guest_token=<token>`  
**Auth:** None

**Request payload:**
```json
{
  "quantity": 3
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Cart item updated"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `guest_token is required` | Missing query param |
| 400 | `quantity is required.` | Missing body |
| 400 | `quantity must be at least 1.` | `quantity < 1` |
| 404 | `CartItem does not exist` | Invalid `itemId` or wrong cart |

---

### 1.4 Remove Guest Cart Item

**Integration point:** Cart page remove button for unauthenticated users.

**Endpoint:** `DELETE /api/cart/items/:itemId?guest_token=<token>`  
**Auth:** None

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Item removed from cart"
}
```

---

### 1.5 Clear Guest Cart

**Integration point:** Cart page clear all button for unauthenticated users.

**Endpoint:** `DELETE /api/cart?guest_token=<token>`  
**Auth:** None

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Cart cleared"
}
```

---

## 2. Authenticated Cart

### 2.1 View Authenticated Cart

**Integration point:** Cart icon / cart page for logged-in users.

**Endpoint:** `GET /api/user/cart`  
**Auth:** Required (`Bearer` token)

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "cart_id": "cart-uuid",
    "items": [
      {
        "id": "item-uuid",
        "product_id": "product-uuid",
        "name": "Product Name",
        "price": 5000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://res.cloudinary.com/...",
        "stock": 10,
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

### 2.2 Add Item to Authenticated Cart

**Integration point:** Product listing/detail "Add to Cart" for logged-in users.

**Endpoint:** `POST /api/user/cart/items`  
**Auth:** Required

**Request payload:**
```json
{
  "product_id": "string (required)",
  "quantity": 1
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Item added to cart"
}
```

**Errors:** Same as guest add item, plus:

| Status | Message | Cause |
|--------|---------|-------|
| 401 | `Unauthorized` | Missing/invalid auth token |

**Behavior:** If the cart contains items from a different shop, they are automatically cleared and the cart is scoped to the new product's shop.

---

### 2.3 Update / Remove / Clear Authenticated Cart

**Endpoints:**
- `PUT /api/user/cart/items/:itemId` — body: `{ "quantity": 3 }`
- `DELETE /api/user/cart/items/:itemId`
- `DELETE /api/user/cart`

**Auth:** Required  
**Responses:** Same shape as guest equivalents.

---

## 3. Checkout

### 3.1 Authenticated Checkout

**Integration point:** Cart page → Checkout button for logged-in users.

**Endpoint:** `POST /api/user/cart/checkout`  
**Auth:** Required

**Request payload:**
```json
{
  "fiat_currency": "NGN (optional, defaults to shop currency)",
  "payment_method": "crypto (default) or paystack",
  "delivery_address": {
    "full_name": "John Doe",
    "phone": "08012345678",
    "address": "12 Main Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "delivery_state": "Lagos (optional)",
  "promo_code": "string (optional)"
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "fiat_amount": 15500,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 2,
    "items_total": 14000,
    "delivery_fee": 1500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_local": 1500,
    "delivery_fee_local_currency": "NGN",
    "discount_amount": 0,
    "delivery_address": { ... },
    "delivery_state": "Lagos",
    "assets": [
      {
        "currency_id": "currency-uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://...",
        "network": { "name": "BSC", "logo": "https://..." },
        "amount": 98.21
      }
    ],
    "items": [
      {
        "product_id": "product-uuid",
        "name": "Product A",
        "price": 7000,
        "currency": "NGN",
        "quantity": 1,
        "image": "https://res.cloudinary.com/...",
        "shop_id": "shop-uuid"
      }
    ]
  },
  "message": "Checkout session created"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `Your cart is empty.` | No items in cart |
| 400 | `Checkout is limited to one shop at a time.` | Items from multiple shops |
| 400 | `Cart total must be greater than 0.` | Total <= 0 |
| 400 | `Unsupported fiat currency: X` | Invalid `fiat_currency` |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 3.2 Guest Checkout

**Integration point:** Cart page → Checkout button for unauthenticated users.

**Endpoint:** `POST /api/cart/checkout`  
**Auth:** None

**Request payload:**
```json
{
  "customer_email": "customer@example.com (required)",
  "items": [
    {
      "product_id": "product-uuid (required)",
      "name": "Product Name (required)",
      "price": 5000 (required, number)",
      "quantity": 1 (required, number)",
      "shopId": "shop-uuid (required)"
    }
  ],
  "fiat_currency": "NGN (optional)",
  "payment_method": "crypto (default)",
  "delivery_address": { ... },
  "delivery_state": "Lagos (optional)",
  "promo_code": "string (optional)"
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "fiat_amount": 15500,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 2,
    "items_total": 14000,
    "delivery_fee": 1500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_local": 1500,
    "delivery_fee_local_currency": "NGN",
    "discount_amount": 0,
    "delivery_address": { ... },
    "delivery_state": "Lagos",
    "assets": [ ... ],
    "items": [ ... ]
  },
  "message": "Checkout session created"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `customer_email is required for guest checkout.` | Missing email |
| 400 | `Cart items are required for guest checkout.` | Missing/empty `items` |
| 400 | `Checkout is limited to one shop at a time.` | Items from multiple shops |
| 400 | `Cart total must be greater than 0.` | Total <= 0 |
| 400 | `Unsupported fiat currency: X` | Invalid `fiat_currency` |

---

### 3.3 Select Crypto Currency for Checkout

**Integration point:** Checkout page — crypto currency selection step.

**Endpoint:** `POST /api/user/cart/wallet`  
**Auth:** Required

**Request payload:**
```json
{
  "payment_intent_id": "intent-uuid (required)",
  "crypto_currency_id": "currency-uuid (required)"
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "expiration_time": "1800",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "0xAbC123... or fib... or 7EcjQq5...",
      "qr_code": "data:image/png;base64,..."
    },
    "fiat": {
      "amount": 15500,
      "currency": "NGN"
    },
    "crypto": {
      "amount": 98.21,
      "currency": "USDT",
      "network": "BSC",
      "address": "0xAbC123..."
    }
  },
  "message": "Payment initiated successfully"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `payment_intent_id is required` | Missing field |
| 400 | `crypto_currency_id is required` | Missing field |
| 404 | `PaymentIntent does not exist` | Invalid `payment_intent_id` |
| 400 | `Invalid crypto currency` | Currency not found or not crypto |
| 400 | `Crypto network not found` | Currency has no network |

---

### 3.4 Guest Select Crypto Currency

**Endpoint:** `POST /api/cart/wallet`  
**Auth:** None

**Request payload:**
```json
{
  "reference_id": "ref-uuid (required)",
  "crypto_currency_id": "currency-uuid (required)"
}
```

**Response:** Same shape as authenticated version.

---

## 4. Products

### 4.1 Create Product

**Integration point:** Merchant dashboard → Add Product page.

**Endpoint:** `POST /api/user/shop/products`  
**Auth:** Required

**Request payload (JSON body):**
```json
{
  "name": "Product Name (required)",
  "price": 5000 (required, number)",
  "description": "Product description (optional)",
  "category": "Electronics (optional)",
  "stock": 10 (optional, default: 0)",
  "track_stock": true (optional)",
  "variants": null (optional)",
  "product_type": "physical (optional)",
  "images": [
    {
      "url": "https://res.cloudinary.com/...",
      "publicId": "wt-payments/shop-product/abc123"
    }
  ]
}
```

**Request payload (multipart form data):**
```
Content-Type: multipart/form-data

name=Product Name
price=5000
description=Product description
category=Electronics
stock=10
images[]=file1.jpg
images[]=file2.jpg
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": 1,
    "uniqueId": "product-uuid",
    "shopId": "shop-uuid",
    "name": "Product Name",
    "price": 5000,
    "currency": "NGN",
    "description": "Product description",
    "category": "Electronics",
    "stock": 10,
    "trackStock": true,
    "variants": null,
    "images": [
      {
        "url": "https://res.cloudinary.com/...",
        "publicId": "wt-payments/shop-product/..."
      }
    ],
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Product created"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `name is required.` | Missing `name` |
| 400 | `price is required.` | Missing `price` |
| 400 | `price must be a number.` | Non-numeric `price` |
| 400 | `Maximum X products allowed for this shop template.` | Product limit reached |
| 400 | `Product type "X" is not allowed for this shop.` | Invalid `product_type` |
| 400 | `category is required for this shop template.` | Missing required category |
| 400 | `This shop template does not support product categories.` | Category provided but not allowed |
| 400 | `This shop template does not support product variants.` | Variants provided but not allowed |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 4.2 Update Product

**Integration point:** Merchant dashboard → Edit Product page.

**Endpoint:** `PUT /api/user/shop/products/:productId`  
**Auth:** Required

**Request payload (JSON — replaces images):**
```json
{
  "name": "Updated Name",
  "price": 6000,
  "images": [
    { "url": "https://...", "publicId": "wt-payments/shop-product/xyz" }
  ]
}
```

**Request payload (multipart — appends images):**
```
Content-Type: multipart/form-data

name=Updated Name
price=6000
images[]=new-file.jpg
```

**Success response (200):**
```json
{
  "error": false,
  "data": { /* product object */ },
  "message": "Product updated"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Various validation errors | Same as create |
| 403 | `You do not own this product` | Product belongs to different shop |
| 404 | `ShopProduct does not exist` | Invalid `productId` |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 4.3 Upload Images to Existing Product

**Integration point:** Merchant dashboard → Product image management.

**Endpoint:** `POST /api/user/shop/products/:productId/images`  
**Auth:** Required

**Request payload (multipart):**
```
Content-Type: multipart/form-data

images[]=file1.jpg
images[]=file2.jpg
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "images": [
      {
        "url": "https://res.cloudinary.com/...",
        "publicId": "wt-payments/shop-product/..."
      }
    ]
  },
  "message": "Images uploaded"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `At least one image is required.` | No files sent |
| 400 | `Invalid file.` | File validation failed |
| 400 | `Maximum X images allowed per product. You already have Y.` | Would exceed max |
| 400 | `Maximum 5 images per upload batch.` | More than 5 files |
| 403 | `You do not own this product` | Wrong shop |
| 404 | `ShopProduct does not exist` | Invalid product |

---

### 4.4 Delete Product Image

**Endpoint:** `DELETE /api/user/shop/products/:productId/images/:publicId`  
**Auth:** Required

**URL param:** `publicId` must be URL-encoded if it contains special characters.

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "images": [ /* remaining images */ ]
  },
  "message": "Image deleted"
}
```

---

### 4.5 List Products

**Integration point:** Merchant dashboard → Product list.

**Endpoint:** `GET /api/user/shop/products?page=1&limit=20&category=Electronics&active=true`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "data": [ /* array of product objects */ ],
    "meta": {
      "total": 50,
      "per_page": 20,
      "current_page": 1,
      "last_page": 3
    }
  }
}
```

---

### 4.6 Delete Product

**Integration point:** Merchant dashboard → Product list → Delete button.

**Endpoint:** `DELETE /api/user/shop/products/:productId`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Product removed"
}
```

**Note:** This is a soft delete — sets `isActive = false`.

---

## 5. Wallets & Balances

### 5.1 Get User Wallets

**Integration point:** Wallet dashboard, withdrawal form wallet selector.

**Endpoint:** `GET /api/user/wallets`  
**Auth:** Required

**Success response (200):**
```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "wallet-uuid",
      "walletAddress": "0xAbC123...",
      "balance": 100.50,
      "totalDeposited": 200.00,
      "totalWithdrawn": 50.00,
      "status": "active",
      "cryptoNetwork": {
        "id": "network-uuid",
        "name": "BSC",
        "logo": "https://cryptologos.cc/logos/bnb-bnb-logo.png",
        "networkType": "evm",
        "chainKey": "bsc",
        "chainId": 56
      },
      "currency": {
        "uniqueId": "currency-uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://..."
      }
    }
  ]
}
```

**Frontend action:** Render one wallet card per entry. Use `cryptoNetwork.logo`, `cryptoNetwork.name`, `currency.symbol`.

---

### 5.2 Dashboard Stats

**Integration point:** Dashboard summary cards.

**Endpoint:** `GET /api/dashboard/stats`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": "Dashboard stats retrieved successfully",
  "result": {
    "totalWalletBalance": 19.42,
    "totalPayout": 0,
    "totalPaymentProcessed": 30399.96,
    "paymentCount": 8
  }
}
```

**Note:** `totalWalletBalance` sums across all active wallets. This is a fallback; prefer the per-wallet `balance` from `GET /api/user/wallets`.

---

## 6. Withdrawals

### 6.1 Initiate Withdrawal

**Integration point:** Withdrawal page — after wallet selection and amount entry.

**Endpoint:** `POST /api/user/withdrawal/initiate`  
**Auth:** Required

**Request payload:**
```json
{
  "type": "crypto (required)",
  "user_wallet_id": "wallet-uuid (required) — must belong to authenticated user",
  "amount": 50 (required, number, must be > 0 and <= wallet balance)",
  "crypto_currency_id": "currency-uuid (required)",
  "network_id": "network-uuid (required)",
  "recipient_address": "0xAbC123... or 7EcjQq5... or TQcZ9Fq... (required)"
}
```

**Success response (200):**
```json
{
  "result": {
    "otp_id": "otp-uuid",
    "fees": {
      "amount": 50,
      "transactionFee": 0.5,
      "estimatedNetworkFee": 0,
      "amountToReceive": 49.5,
      "asset": "USDT",
      "estimatedArrivalMinutes": 1
    }
  }
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `type is required` | Missing `type` |
| 400 | `user_wallet_id is required` | Missing `user_wallet_id` |
| 400 | `amount must be greater than zero` | `amount <= 0` |
| 400 | `Insufficient balance` | `amount > wallet.balance` |
| 400 | `Invalid currency for this network` | Currency/network mismatch |
| 400 | `Invalid recipient address` | Address format doesn't match network |
| 400 | `Recipient address is required` | Missing `recipient_address` |
| 404 | `User wallet not found` | Invalid `user_wallet_id` |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 6.2 Confirm Withdrawal (OTP)

**Integration point:** Withdrawal page — OTP input after initiation.

**Endpoint:** `POST /api/user/withdrawal/confirm`  
**Auth:** Required

**Request payload:**
```json
{
  "otp_id": "otp-uuid (required)",
  "otp_code": "123456 (required)"
}
```

**Success response (200):**
```json
{
  "result": {
    "status": "completed",
    "tx_hash": "abc123def456...",
    "transactionId": "tx-uuid"
  }
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `otp_id is required` | Missing `otp_id` |
| 400 | `otp_code is required` | Missing `otp_code` |
| 400 | `Invalid or expired OTP` | Wrong/expired code |
| 404 | `Transaction not found` | Invalid `otp_id` |

---

### 6.3 Withdrawal History

**Integration point:** Withdrawal history page.

**Endpoint:** `GET /api/user/withdrawals/history?page=1&per_page=20`  
**Auth:** Required

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "tx-uuid",
        "paid_on": "04 Sept. 2026",
        "method": "Crypto",
        "crypto_currency": "USDT",
        "wallet": "TQcZ9FqK9w8fZ6fQo1J19w6dE6w8fZ6fQo1J19w6dE6",
        "amount": 50,
        "status": "completed",
        "network": "Tron",
        "tx_hash": "abc123..."
      }
    ],
    "meta": {
      "total": 1,
      "per_page": 20,
      "current_page": 1,
      "last_page": 1
    }
  }
}
```

---

## 7. Transaction History

### 7.1 Payment Intent History

**Integration point:** Transaction history page, order history.

**Endpoint:** `GET /api/user/payment-intent/history?page=1&limit=20`  
**Auth:** Required

**Success response (200):**
```json
{
  "result": {
    "data": [
      {
        "transaction_id": "tx-uuid",
        "reference_id": "order_123",
        "amount": 50000,
        "currency": "NGN",
        "status": "payment_completed",
        "crypto_amount": "10.5",
        "crypto_currency": "USDC",
        "network": "Solana",
        "tx_hash": "5KtPn4...",
        "wallet_address": "7EcjQq5...",
        "created_at": "2026-08-31T08:00:00Z",
        "completed_at": "2026-08-31T08:05:00Z"
      }
    ]
  }
}
```

**Note:** `network` can be `"Solana"` or `"Tron"` in addition to existing values.

---

### 7.2 Transaction Detail

**Integration point:** Transaction detail page.

**Endpoint:** `GET /api/user/transactions/:id`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": "tx-uuid",
    "type": "receive",
    "status": "completed",
    "amount_crypto": 10.5,
    "currency": "USDC",
    "network": "Solana",
    "wallet_address": "7EcjQq5RXkqBaDb2LDWSDbQmybg4GBFPJV2H9DDJr4V",
    "tx_hash": "5KtPn4...",
    "completed_at": "2026-08-31T12:00:00Z",
    "user_wallet_id": "wallet-uuid"
  }
}
```

---

## 8. Available Assets

### 8.1 Get Available Assets

**Integration point:** Checkout currency selector, withdrawal currency selector.

**Endpoint:** `GET /api/available-assets`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "message": "Available assets fetched successfully",
  "data": [
    {
      "currency_id": "currency-uuid",
      "crypto": {
        "id": "currency-uuid",
        "name": "Solana",
        "symbol": "SOL",
        "logo": "https://...",
        "type": "crypto",
        "contractAddress": null,
        "ratePerUsd": 150.00
      },
      "network": {
        "id": "network-uuid",
        "name": "Solana",
        "logo": "https://cryptologos.cc/logos/solana-sol-logo.png",
        "isTestnet": true,
        "networkType": "solana",
        "chainKey": "solana",
        "chainId": null
      }
    },
    {
      "currency_id": "currency-uuid",
      "crypto": {
        "id": "currency-uuid",
        "name": "Tether USD",
        "symbol": "USDT",
        "logo": "https://...",
        "type": "crypto",
        "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "ratePerUsd": 1.0
      },
      "network": {
        "id": "network-uuid",
        "name": "Tron",
        "logo": "https://cryptologos.cc/logos/tron-trx-logo.png",
        "isTestnet": false,
        "networkType": "tron",
        "chainKey": "tron",
        "chainId": null
      }
    }
  ]
}
```

**Frontend action:**
- Group by `network.networkType`
- Show `network.logo` next to each asset
- Use `networkType` for address validation
- `chainId` is numeric for EVM, `null` for Solana/Tron

---

## 9. SSE Events

### 9.1 Connect to SSE Stream

**Integration point:** Dashboard, wallet page, transaction history — real-time updates.

**Endpoint:** `GET /api/user/stream`  
**Auth:** Required (`Authorization: Bearer <token>` header or `?token=<token>` query param)

**Connection:** Use `EventSource` or equivalent SSE client.

---

### 9.2 Wallet Balance Updated

**Event name:** `wallet.balance_updated`

**Payload:**
```json
{
  "event": "wallet.balance_updated",
  "data": {
    "total_balance_usd": 19.42,
    "total_balance_ngn": 25000,
    "wallets": [
      {
        "wallet_id": "wallet-uuid",
        "balance": 10.5,
        "currency_id": "currency-uuid",
        "network": "BSC"
      }
    ]
  }
}
```

**Frontend action:** Update each wallet card's balance individually using the `wallets` array.

---

### 9.3 Transaction Confirmed

**Event name:** `transaction.confirmed`

**Payload:**
```json
{
  "event": "transaction.confirmed",
  "data": {
    "transaction_id": "tx-uuid",
    "reference_id": "order_123",
    "amount": 50000,
    "currency": "NGN",
    "status": "payment_completed",
    "crypto_amount": "10.5",
    "crypto_currency": "USDC",
    "network": "Solana",
    "wallet_address": "7EcjQq5...",
    "completed_at": "2026-08-31T12:00:00Z"
  }
}
```

**Frontend action:** Show success notification, refresh transaction list, update wallet balance.

---

### 9.4 Withdrawal Updated

**Event name:** `withdrawal.updated`

**Payload:**
```json
{
  "event": "withdrawal.updated",
  "data": {
    "type": "crypto",
    "network": "Tron",
    "status": "completed",
    "amount": 49.5,
    "tx_hash": "abc123...",
    "recipient": "TQcZ9Fq...",
    "currency": "USDT",
    "transaction_id": "tx-uuid"
  }
}
```

**Possible status values:** `pending`, `processing`, `completed`, `failed`

**Frontend action:** Update withdrawal status in history list, show toast notification.

---

## 10. Delivery Settings

### 10.1 Get Delivery Settings

**Integration point:** Merchant dashboard → Delivery settings page.

**Endpoint:** `GET /api/user/shop/delivery-settings`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": "settings-uuid",
    "shop_id": "shop-uuid",
    "has_free_delivery": false,
    "delivery_fee": 1500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_usd": 1.05,
    "delivery_zones": {
      "Lagos": 1500,
      "Abuja": 2000
    },
    "discount_percentage": 10,
    "discount_amount": 500,
    "promo_code": "SAVE10",
    "free_delivery_threshold": 20000
  }
}
```

---

### 10.2 Update Delivery Settings

**Integration point:** Merchant dashboard → Delivery settings form.

**Endpoint:** `PUT /api/user/shop/delivery-settings`  
**Auth:** Required

**Request payload:**
```json
{
  "has_free_delivery": false,
  "delivery_fee": 1500,
  "delivery_fee_currency": "NGN",
  "delivery_zones": {
    "Lagos": 1500,
    "Abuja": 2000
  },
  "discount_percentage": 10,
  "discount_amount": 500,
  "promo_code": "SAVE10",
  "free_delivery_threshold": 20000
}
```

**Field descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `has_free_delivery` | boolean | If true, delivery fee is waived |
| `delivery_fee` | number | Default delivery fee in `delivery_fee_currency` |
| `delivery_fee_currency` | string | ISO currency code, defaults to shop currency |
| `delivery_zones` | object | Map of state/location → fee in that location's currency |
| `discount_percentage` | number | Percentage off (e.g., 10 for 10% off) |
| `discount_amount` | number | Fixed amount discount |
| `promo_code` | string | Promo code customers can enter |
| `free_delivery_threshold` | number \| null | Minimum order amount for free delivery |

**Success response (200):**
```json
{
  "error": false,
  "data": { /* same shape as GET */ },
  "message": "Delivery settings updated"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `No shop found. Please create a shop first.` | User has no shop |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 10.3 Public Delivery Settings

**Integration point:** Checkout page — show delivery fee before completing order.

**Endpoint:** `GET /api/shop/:subdomain/delivery-settings`  
**Auth:** None

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "has_free_delivery": false,
    "delivery_fee": 1500,
    "delivery_fee_currency": "NGN",
    "delivery_fee_usd": 1.05,
    "delivery_zones": { "Lagos": 1500 },
    "discount_percentage": 10,
    "discount_amount": 500,
    "promo_code": "SAVE10",
    "free_delivery_threshold": 20000
  }
}
```

---

## 11. Orders

### 11.1 List Orders

**Integration point:** Merchant dashboard → Orders page.

**Endpoint:** `GET /api/user/shop/orders?shop_id=<shop-uuid>&page=1&limit=20&status=pending`  
**Auth:** Required

**Query params:**
- `shop_id` — optional, defaults to user's first shop
- `status` — optional filter: `pending`, `processing`, `shipped`, `delivered`, `cancelled`
- `page`, `limit` — pagination

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "data": [
      {
        "id": "intent-uuid",
        "reference_id": "ref-uuid",
        "payment_status": "payment_completed",
        "order_status": "pending",
        "amount": 15500,
        "currency": "NGN",
        "customer": {
          "id": "customer-uuid",
          "email": "customer@example.com",
          "phone": "08012345678"
        },
        "items": [
          {
            "product_id": "product-uuid",
            "name": "Product A",
            "quantity": 2,
            "price": 5000
          }
        ],
        "delivery_address": {
          "full_name": "John Doe",
          "phone": "08012345678",
          "address": "12 Main Street",
          "city": "Lagos",
          "state": "Lagos",
          "country": "Nigeria"
        },
        "delivery_state": "Lagos",
        "created_at": "2026-08-31T08:00:00Z",
        "paid_at": "2026-08-31T08:05:00Z",
        "updated_at": "2026-08-31T08:05:00Z"
      }
    ],
    "meta": {
      "total": 50,
      "per_page": 20,
      "current_page": 1,
      "last_page": 3
    }
  }
}
```

---

### 11.2 Get Order Detail

**Integration point:** Merchant dashboard → Order detail page.

**Endpoint:** `GET /api/user/shop/orders/:orderId?shop_id=<shop-uuid>`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": "intent-uuid",
    "reference_id": "ref-uuid",
    "payment_status": "payment_completed",
    "order_status": "pending",
    "amount": 15500,
    "currency": "NGN",
    "customer": { ... },
    "items": [ ... ],
    "delivery_address": { ... },
    "delivery_state": "Lagos",
    "created_at": "...",
    "paid_at": "...",
    "updated_at": "..."
  }
}
```

---

### 11.3 Update Order Status

**Integration point:** Merchant dashboard → Order detail → Status dropdown.

**Endpoint:** `PATCH /api/user/shop/orders/:orderId/status?shop_id=<shop-uuid>`  
**Auth:** Required

**Request payload:**
```json
{
  "status": "processing"
}
```

**Allowed statuses:** `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Success response (200):**
```json
{
  "error": false,
  "data": { /* updated order object */ },
  "message": "Order status updated"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `status must be one of: pending, processing, shipped, delivered, cancelled` | Invalid status |
| 404 | `PaymentIntent does not exist` | Invalid order ID |
| 403 | `You do not own this order` | Order belongs to different shop |

---

### 11.4 Order Analytics

**Integration point:** Merchant dashboard → Analytics page.

**Endpoint:** `GET /api/user/shop/orders/analytics?shop_id=<shop-uuid>&from=2026-01-01&to=2026-12-31`  
**Auth:** Required

**Query params:**
- `from` — ISO date, defaults to 30 days ago
- `to` — ISO date, defaults to today

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T23:59:59.999Z",
    "total_orders": 150,
    "total_revenue": 2500000,
    "by_status": {
      "pending": { "count": 20, "amount": 300000 },
      "processing": { "count": 10, "amount": 150000 },
      "shipped": { "count": 50, "amount": 1000000 },
      "delivered": { "count": 65, "amount": 1050000 },
      "cancelled": { "count": 5, "amount": 50000 }
    }
  }
}
```

---

## 11. Orders

### 11.1 List Orders

**Integration point:** Merchant dashboard → Orders page.

**Endpoint:** `GET /api/user/shop/orders?shop_id=<shop-uuid>&page=1&limit=20&status=pending`  
**Auth:** Required

**Query params:**
- `shop_id` — optional, defaults to user's first shop
- `status` — optional filter: `pending`, `processing`, `shipped`, `delivered`, `cancelled`
- `page`, `limit` — pagination

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "data": [
      {
        "id": "intent-uuid",
        "reference_id": "ref-uuid",
        "payment_status": "payment_completed",
        "order_status": "pending",
        "amount": 15500,
        "currency": "NGN",
        "customer": {
          "id": "customer-uuid",
          "email": "customer@example.com",
          "phone": "08012345678"
        },
        "items": [
          {
            "product_id": "product-uuid",
            "name": "Product A",
            "quantity": 2,
            "price": 5000
          }
        ],
        "delivery_address": {
          "full_name": "John Doe",
          "phone": "08012345678",
          "address": "12 Main Street",
          "city": "Lagos",
          "state": "Lagos",
          "country": "Nigeria"
        },
        "delivery_state": "Lagos",
        "created_at": "2026-08-31T08:00:00Z",
        "paid_at": "2026-08-31T08:05:00Z",
        "updated_at": "2026-08-31T08:05:00Z"
      }
    ],
    "meta": {
      "total": 50,
      "per_page": 20,
      "current_page": 1,
      "last_page": 3
    }
  }
}
```

---

### 11.2 Get Order Detail

**Integration point:** Merchant dashboard → Order detail page.

**Endpoint:** `GET /api/user/shop/orders/:orderId?shop_id=<shop-uuid>`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": "intent-uuid",
    "reference_id": "ref-uuid",
    "payment_status": "payment_completed",
    "order_status": "pending",
    "amount": 15500,
    "currency": "NGN",
    "customer": { ... },
    "items": [ ... ],
    "delivery_address": { ... },
    "delivery_state": "Lagos",
    "created_at": "...",
    "paid_at": "...",
    "updated_at": "..."
  }
}
```

---

### 11.3 Update Order Status

**Integration point:** Merchant dashboard → Order detail → Status dropdown.

**Endpoint:** `PATCH /api/user/shop/orders/:orderId/status?shop_id=<shop-uuid>`  
**Auth:** Required

**Request payload:**
```json
{
  "status": "processing"
}
```

**Allowed statuses:** `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Success response (200):**
```json
{
  "error": false,
  "data": { /* updated order object */ },
  "message": "Order status updated"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `status must be one of: pending, processing, shipped, delivered, cancelled` | Invalid status |
| 404 | `PaymentIntent does not exist` | Invalid order ID |
| 403 | `You do not own this order` | Order belongs to different shop |

---

### 11.4 Order Analytics (with Chart Data)

**Integration point:** Merchant dashboard → Analytics page, charts, revenue graphs.

**Endpoint:** `GET /api/user/shop/orders/analytics?shop_id=<shop-uuid>&from=2026-01-01&to=2026-12-31&group_by=day`  
**Auth:** Required

**Query params:**
- `from` — ISO date, defaults to 30 days ago
- `to` — ISO date, defaults to today
- `group_by` — `day` (default), `week`, or `month`

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T23:59:59.999Z",
    "group_by": "day",
    "total_orders": 150,
    "total_revenue": 2500000,
    "unique_customers": 85,
    "link_clicks": 1200,
    "by_status": {
      "pending": { "count": 20, "amount": 300000 },
      "processing": { "count": 10, "amount": 150000 },
      "shipped": { "count": 50, "amount": 1000000 },
      "delivered": { "count": 65, "amount": 1050000 },
      "cancelled": { "count": 5, "amount": 50000 }
    },
    "time_series": [
      {
        "period": "2026-01-01T00:00:00.000Z",
        "order_count": 5,
        "total_amount": 85000
      },
      {
        "period": "2026-01-02T00:00:00.000Z",
        "order_count": 8,
        "total_amount": 120000
      }
    ]
  }
}
```

**Frontend chart mapping:**
- Use `time_series[].period` for X-axis labels
- Use `time_series[].order_count` for order count line/bar chart
- Use `time_series[].total_amount` for revenue line/bar chart
- `by_status` for order status breakdown pie/donut chart

---

### 11.5 Order Messages

**Integration point:** Merchant dashboard → Order detail → Messages tab.

#### 11.5.1 List Order Messages

**Endpoint:** `GET /api/user/shop/orders/:orderId/messages?shop_id=<shop-uuid>`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "data": [
      {
        "id": "msg-uuid",
        "sender_id": "user-uuid",
        "sender_type": "merchant",
        "message": "Your order has been shipped.",
        "is_read": true,
        "created_at": "2026-08-31T10:00:00Z",
        "updated_at": "2026-08-31T10:00:00Z"
      },
      {
        "id": "msg-uuid-2",
        "sender_id": "customer-uuid",
        "sender_type": "customer",
        "message": "Thanks, when will it arrive?",
        "is_read": false,
        "created_at": "2026-08-31T11:00:00Z",
        "updated_at": "2026-08-31T11:00:00Z"
      }
    ]
  }
}
```

**sender_type values:** `customer`, `merchant`, `system`

---

#### 11.5.2 Send Order Message

**Endpoint:** `POST /api/user/shop/orders/:orderId/messages?shop_id=<shop-uuid>`  
**Auth:** Required

**Request payload:**
```json
{
  "message": "Your order has been shipped.",
  "sender_type": "merchant"
}
```

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "id": "msg-uuid",
    "sender_id": "user-uuid",
    "sender_type": "merchant",
    "message": "Your order has been shipped.",
    "is_read": false,
    "created_at": "2026-08-31T10:00:00Z"
  },
  "message": "Order message sent"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `order_id is required` | Missing order ID |
| 400 | `message is required` | Empty message |
| 404 | `PaymentIntent does not exist` | Invalid order ID |
| 403 | `You do not own this order` | Wrong shop |

---

#### 11.5.3 Mark Messages as Read

**Endpoint:** `PATCH /api/user/shop/orders/:orderId/messages/read?shop_id=<shop-uuid>`  
**Auth:** Required

**Success response (200):**
```json
{
  "error": false,
  "data": null,
  "message": "Messages marked as read"
}
```

---

## 12. Payment Link Analytics

### 12.1 Get Payment Link Performance

**Integration point:** Merchant dashboard → Payment Links page → Analytics tab.

**Endpoint:** `GET /api/client/payment-links/analytics?from=2026-01-01&to=2026-12-31`  
**Auth:** Required

**Query params:**
- `from` — ISO date, defaults to 30 days ago
- `to` — ISO date, defaults to today

**Success response (200):**
```json
{
  "error": false,
  "data": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T23:59:59.999Z",
    "total_clicks": 1200,
    "total_orders": 85,
    "total_revenue": 2500000,
    "links": [
      {
        "id": "link-uuid",
        "slug": "pay/john-doe",
        "title": "John Doe Payment Link",
        "usage_count": 500,
        "order_count": 35,
        "revenue": 1200000,
        "currency": "NGN",
        "is_active": true,
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Field descriptions:**

| Field | Description |
|-------|-------------|
| `total_clicks` | Sum of all `usage_count` values across all links |
| `total_orders` | Sum of completed payment intents across all links |
| `total_revenue` | Sum of `fiat_amount` from completed payment intents |
| `links[].usage_count` | How many times the link was visited/used |
| `links[].order_count` | Number of completed orders from this link |
| `links[].revenue` | Total revenue from completed orders for this link |

**Note:** `usage_count` is incremented each time the payment link checkout endpoint is called, regardless of whether payment completes.

---

## 13. Error Handling

### Standard Error Shape

All endpoints return errors in this shape:

```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": 400,
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

**Note:** Some older endpoints may omit `errors` or `code`. Always check `error` boolean and `message`.

### Common HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created (product creation) |
| 400 | Bad request — validation error |
| 401 | Unauthorized — missing/invalid auth token |
| 403 | Forbidden — resource belongs to another user/shop |
| 404 | Not found |
| 410 | Gone — resource no longer active (e.g., expired payment link) |
| 500 | Server error |

### Frontend Error Handling Rules

1. **401 Unauthorized:** Clear stored auth token, redirect to login, show toast: "Session expired. Please log in again."
2. **403 Forbidden:** Show toast: "You don't have permission to access this resource."
3. **404 Not Found:** Show toast: "Resource not found." Navigate back if on detail page.
4. **410 Gone:** Show: "This payment link is no longer active." for payment links; "Session expired." for checkout.
5. **400 Bad Request:** Display `message` to user. If `errors` object exists, show field-specific errors inline.
6. **Network errors:** Show: "Network error. Please check your connection and try again."
7. **500 Server error:** Show: "Something went wrong. Please try again later."

---

## Appendix: Quick Reference — Endpoint by Feature

| Feature | Endpoint | Method | Auth |
|---------|----------|--------|------|
| **Guest Cart** | | | |
| Add to cart | `/api/cart/items` | POST | No |
| View cart | `/api/cart` | GET | No |
| Update item | `/api/cart/items/:itemId` | PUT | No |
| Remove item | `/api/cart/items/:itemId` | DELETE | No |
| Clear cart | `/api/cart` | DELETE | No |
| **Auth Cart** | | | |
| View cart | `/api/user/cart` | GET | Yes |
| Add to cart | `/api/user/cart/items` | POST | Yes |
| Update item | `/api/user/cart/items/:itemId` | PUT | Yes |
| Remove item | `/api/user/cart/items/:itemId` | DELETE | Yes |
| Clear cart | `/api/user/cart` | DELETE | Yes |
| Checkout | `/api/user/cart/checkout` | POST | Yes |
| Select currency | `/api/user/cart/wallet` | POST | Yes |
| **Guest Checkout** | | | |
| Checkout | `/api/cart/checkout` | POST | No |
| Select currency | `/api/cart/wallet` | POST | No |
| **Products** | | | |
| List products | `/api/user/shop/products` | GET | Yes |
| Create product | `/api/user/shop/products` | POST | Yes |
| Update product | `/api/user/shop/products/:id` | PUT | Yes |
| Delete product | `/api/user/shop/products/:id` | DELETE | Yes |
| Upload images | `/api/user/shop/products/:id/images` | POST | Yes |
| Delete image | `/api/user/shop/products/:id/images/:publicId` | DELETE | Yes |
| **Wallets** | | | |
| List wallets | `/api/user/wallets` | GET | Yes |
| Dashboard stats | `/api/dashboard/stats` | GET | Yes |
| **Withdrawals** | | | |
| Initiate | `/api/user/withdrawal/initiate` | POST | Yes |
| Confirm | `/api/user/withdrawal/confirm` | POST | Yes |
| History | `/api/user/withdrawals/history` | GET | Yes |
| **Transactions** | | | |
| Payment history | `/api/user/payment-intent/history` | GET | Yes |
| Transaction detail | `/api/user/transactions/:id` | GET | Yes |
| **Assets** | | | |
| Available assets | `/api/available-assets` | GET | Yes |
| **SSE** | | | |
| Live stream | `/api/user/stream` | GET | Yes |
| **Delivery** | | | |
| Get settings | `/api/user/shop/delivery-settings` | GET | Yes |
| Update settings | `/api/user/shop/delivery-settings` | PUT | Yes |
| Public settings | `/api/shop/:subdomain/delivery-settings` | GET | No |
| **Orders** | | | |
| List orders | `/api/user/shop/orders` | GET | Yes |
| Order detail | `/api/user/shop/orders/:id` | GET | Yes |
| Update status | `/PATCH /api/user/shop/orders/:id/status` | PATCH | Yes |
| Order messages | `/api/user/shop/orders/:orderId/messages` | GET | Yes |
| Send message | `/api/user/shop/orders/:orderId/messages` | POST | Yes |
| Mark read | `/PATCH /api/user/shop/orders/:orderId/messages/read` | PATCH | Yes |
| Analytics | `/api/user/shop/orders/analytics` | GET | Yes |
| **Payment Links** | | | |
| List links | `/api/client/payment-links` | GET | Yes |
| Create link | `/api/client/payment-links` | POST | Yes |
| Get link | `/api/client/payment-links/:id` | GET | Yes |
| Update link | `/PATCH /api/client/payment-links/:id` | PATCH | Yes |
| Delete link | `/DELETE /api/client/payment-links/:id` | DELETE | Yes |
| Link analytics | `/api/client/payment-links/analytics` | GET | Yes |

---

## Appendix: Address Validation Regexes

Use these on the frontend to validate recipient addresses before submitting withdrawals:

```js
const ADDRESS_REGEX = {
  evm: /^0x[a-fA-F0-9]{40}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  eth: /^0x[a-fA-F0-9]{40}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  ckb: /^ckb1q[1-9A-HJ-NP-Za-km-z]{39,59}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tron: /^T[a-km-zA-HJ-NP-Z1-9]{33}$/,
}

function isValidAddress(address, chainKey, networkType) {
  const key = networkType === 'evm' ? chainKey : networkType
  return ADDRESS_REGEX[key]?.test(address) || false
}
```

---

## Appendix: Checkout Total Calculation (Frontend Reference)

The backend calculates the total as:

```
total = items_total + delivery_fee_in_checkout_currency - discount_amount
```

Where:
- `items_total` = sum of `price * quantity` for all cart items
- `delivery_fee_in_checkout_currency` = delivery fee converted to checkout currency if different from shop currency
- `discount_amount` = fixed discount + percentage discount

The `fiat_amount` returned by checkout is already the final total in the checkout currency. Frontend should display this as the payable amount.

For crypto conversion, each asset's `amount` field in the `assets` array already contains the crypto equivalent of `fiat_amount` for that currency.

---

## 13. Auto-Settlement Settings

### 13.1 Get Auto-Settlement Settings

**Integration point:** Merchant dashboard → Settings → Auto-Settlement tab.

**Endpoint:** `GET /api/user/settings/general`  
**Auth:** Required

**New response fields:**
```json
{
  "error": false,
  "data": {
    "fee_bearer": "BUSINESS",
    "current_environment": "TEST",
    "payout_interval": "DAILY",
    "payout_type": "CRYPTO",
    "auto_settlement_enabled": false,
    "auto_settlement_time": "18:00",
    "payout_method": "wallet",
    "payout_wallet_id": "wallet-uuid",
    "payout_currency_id": "currency-uuid",
    "payout_bank_account_no": "0123456789",
    "payout_bank_name": "GTBank",
    "payout_account_name": "John Doe",
    "payout_bank_code": "058",
    "last_payout_at": "2026-09-15T18:00:00.000Z",
    "last_payout_status": "completed"
  }
}
```

---

### 13.2 Update Auto-Settlement Settings

**Integration point:** Merchant dashboard → Settings → Auto-Settlement form.

**Endpoint:** `POST /api/client/settings/general`  
**Auth:** Required

**Request payload:**
```json
{
  "auto_settlement_enabled": true,
  "auto_settlement_time": "18:00",
  "payout_method": "wallet",
  "payout_wallet_id": "wallet-uuid",
  "payout_currency_id": "currency-uuid",
  "payout_bank_account_no": "0123456789",
  "payout_bank_name": "GTBank",
  "payout_account_name": "John Doe",
  "payout_bank_code": "058"
}
```

**Field descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `auto_settlement_enabled` | boolean | Enable/disable automatic payouts |
| `auto_settlement_time` | string | Time of day to run settlement (24h format, e.g., `"18:00"`) |
| `payout_method` | string | `"wallet"` or `"bank"` |
| `payout_wallet_id` | string | UserWallet uniqueId to send crypto to (required if `payout_method = "wallet"`) |
| `payout_currency_id` | string | Currency uniqueId for wallet payout (required if `payout_method = "wallet"`) |
| `payout_bank_account_no` | string | Bank account number (required if `payout_method = "bank"`) |
| `payout_bank_name` | string | Bank name (required if `payout_method = "bank"`) |
| `payout_account_name` | string | Account holder name (required if `payout_method = "bank"`) |
| `payout_bank_code` | string | Bank code (required if `payout_method = "bank"`) |

**Success response (200):**
```json
{
  "error": false,
  "data": { /* updated settings object */ },
  "message": "Settings updated successfully"
}
```

**Error responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Validation error | Missing required fields for selected `payout_method` |
| 401 | `Unauthorized` | Missing/invalid auth |

---

### 13.3 How Auto-Settlement Works

1. **Schedule:** A cron job or scheduled task runs `node ace process:payouts` after business hours (e.g., 18:00 daily)
2. **Eligibility:** Only businesses with `auto_settlement_enabled = true` and `auto_settlement_time <= current_time` are processed
3. **Payout calculation:** Total balance across all active wallets is summed in USDT
4. **Payout destination:**
   - If `payout_method = "wallet"`: sends crypto to the specified `payout_wallet_id`
   - If `payout_method = "bank"`: converts USDT to NGN and sends to bank account via Paystack
5. **Record:** `last_payout_at` and `last_payout_status` are updated on the `BusinessSetting` record

### 13.4 Frontend Settings Page

**File:** `app/dashboard/settings/auto-settlement/page.tsx`

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function AutoSettlementSettings() {
  const [settings, setSettings] = useState({
    auto_settlement_enabled: false,
    auto_settlement_time: '18:00',
    payout_method: 'wallet',
    payout_wallet_id: '',
    payout_currency_id: '',
    payout_bank_account_no: '',
    payout_bank_name: '',
    payout_account_name: '',
    payout_bank_code: '',
    last_payout_at: null,
    last_payout_status: null,
  })
  const [saving, setSaving] = useState(false)
  const [wallets, setWallets] = useState([])

  useEffect(() => {
    fetch('/api/user/settings/general', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setSettings(res.data)
      })

    fetch('/api/user/wallets', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setWallets(res.data || [])
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    await fetch('/api/client/settings/general', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(settings),
    })

    setSaving(false)
    alert('Auto-settlement settings saved!')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Auto-Settlement Settings</h1>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.auto_settlement_enabled}
            onChange={(e) => setSettings({ ...settings, auto_settlement_enabled: e.target.checked })}
          />
          Enable automatic payouts
        </label>
        <p className="text-sm text-gray-500">
          Automatically send your earnings to your chosen account after business hours.
        </p>
      </div>

      {settings.auto_settlement_enabled && (
        <>
          <div>
            <label>Payout Time (24h format)</label>
            <input
              type="time"
              value={settings.auto_settlement_time}
              onChange={(e) => setSettings({ ...settings, auto_settlement_time: e.target.value })}
              className="border p-2"
            />
            <p className="text-sm text-gray-500">
              Payouts will be processed after this time each day.
            </p>
          </div>

          <div>
            <label>Payout Method</label>
            <select
              value={settings.payout_method}
              onChange={(e) => setSettings({ ...settings, payout_method: e.target.value })}
              className="border p-2 w-full"
            >
              <option value="wallet">Crypto Wallet</option>
              <option value="bank">Bank Account (NGN)</option>
            </select>
          </div>

          {settings.payout_method === 'wallet' && (
            <div>
              <label>Destination Wallet</label>
              <select
                value={settings.payout_wallet_id}
                onChange={(e) => setSettings({ ...settings, payout_wallet_id: e.target.value })}
                className="border p-2 w-full"
              >
                <option value="">Select wallet</option>
                {wallets.map((w: any) => (
                  <option key={w.uniqueId} value={w.uniqueId}>
                    {w.cryptoNetwork.name} — {w.walletAddress.slice(0, 8)}...{w.walletAddress.slice(-6)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {settings.payout_method === 'bank' && (
            <div className="space-y-4">
              <div>
                <label>Bank Account Number</label>
                <input
                  type="text"
                  value={settings.payout_bank_account_no}
                  onChange={(e) => setSettings({ ...settings, payout_bank_account_no: e.target.value })}
                  className="border p-2 w-full"
                />
              </div>
              <div>
                <label>Bank Name</label>
                <input
                  type="text"
                  value={settings.payout_bank_name}
                  onChange={(e) => setSettings({ ...settings, payout_bank_name: e.target.value })}
                  className="border p-2 w-full"
                />
              </div>
              <div>
                <label>Account Name</label>
                <input
                  type="text"
                  value={settings.payout_account_name}
                  onChange={(e) => setSettings({ ...settings, payout_account_name: e.target.value })}
                  className="border p-2 w-full"
                />
              </div>
              <div>
                <label>Bank Code</label>
                <input
                  type="text"
                  value={settings.payout_bank_code}
                  onChange={(e) => setSettings({ ...settings, payout_bank_code: e.target.value })}
                  className="border p-2 w-full"
                />
              </div>
            </div>
          )}

          {settings.last_payout_at && (
            <div className="text-sm text-gray-500">
              Last payout: {new Date(settings.last_payout_at).toLocaleString()} — Status: {settings.last_payout_status}
            </div>
          )}
        </>
      )}

      <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">
        {saving ? 'Saving...' : 'Save Auto-Settlement Settings'}
      </button>
    </form>
  )
}
```

---

## 14. Command Line — Process Payouts

### Manual trigger

```bash
# Dry run — see what would be paid out
node ace process:payouts --dryRun

# Actual run — process all due auto-settlements
node ace process:payouts
```

### Cron setup (recommended)

Run after business hours daily:

```bash
0 18 * * * cd /path/to/app && node ace process:payouts >> storage/logs/auto-settlement.log 2>&1
```

Or every 6 hours:

```bash
0 */6 * * * cd /path/to/app && node ace process:payouts >> storage/logs/auto-settlement.log 2>&1
```

### What the command does

1. Finds all businesses with `auto_settlement_enabled = true` and `auto_settlement_time <= current_time`
2. Checks if enough time has passed since `last_payout_at` based on `payout_interval` (DAILY = 24h, WEEKLY = 168h)
3. Sums total balance across all active wallets in USDT
4. If `payout_method = "wallet"`: initiates crypto withdrawal to the configured wallet
5. If `payout_method = "bank"`: converts USDT to NGN and initiates bank transfer via Paystack
6. Updates `last_payout_at` and `last_payout_status` on the `BusinessSetting` record

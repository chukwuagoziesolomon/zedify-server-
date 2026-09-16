# Frontend Integration Guide — Current Backend Contract

This document describes the exact frontend changes required to match the current backend API. It is not a generic overview; every section reflects a real endpoint or data shape change already in effect.

## 1. Guest Cart (No Login Required)

The backend now supports guest cart operations. Users do not need an account to add items to cart or checkout.

### 1.1 Guest Token Flow

1. Call `POST /api/cart/items` **without** a `guest_token`.
2. The backend returns a `guest_token` in the response.
3. Store the token in `localStorage` or a cookie on the frontend.
4. Include `?guest_token=<token>` on all subsequent guest cart requests.

### 1.2 Guest Cart Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/cart?guest_token=<token>` | View guest cart | No |
| `POST` | `/api/cart/items` | Add item to guest cart. Body: `{ product_id, quantity?, guest_token? }`. If `guest_token` is omitted, backend creates one and returns it. | No |
| `PUT` | `/api/cart/items/:itemId?guest_token=<token>` | Update guest cart item quantity. Body: `{ quantity }` | No |
| `DELETE` | `/api/cart/items/:itemId?guest_token=<token>` | Remove guest cart item | No |
| `DELETE` | `/api/cart?guest_token=<token>` | Clear guest cart | No |

**Response for `POST /api/cart/items` (guest):**
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

**Important:** On subsequent calls, send `guest_token` as a query parameter, not in the body.

### 1.3 Authenticated Cart Endpoints (Unchanged)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/user/cart` | View authenticated cart | Yes |
| `POST` | `/api/user/cart/items` | Add item. Body: `{ product_id, quantity? }` | Yes |
| `PUT` | `/api/user/cart/items/:itemId` | Update item. Body: `{ quantity }` | Yes |
| `DELETE` | `/api/user/cart/items/:itemId` | Remove item | Yes |
| `DELETE` | `/api/user/cart` | Clear cart | Yes |
| `POST` | `/api/user/cart/checkout` | Checkout | Yes |

### 1.4 Cart is Scoped Per Shop

The backend now tracks which shop a cart belongs to via `shop_id` on the `carts` table.

- If a user adds an item from **Shop A**, then adds an item from **Shop B**, the cart is **automatically cleared** and scoped to Shop B.
- This means cart items from different shops will never coexist.
- The `shop_id` is set automatically by the backend; the frontend does not need to send it.

### 1.5 Cart Item Response Shape

Both guest and authenticated `show` endpoints return:

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

## 2. Checkout Response Now Includes Order Items

Both authenticated and guest checkout responses now include a full `items` array with product details.

### 2.1 Authenticated Checkout

**Endpoint:** `POST /api/user/cart/checkout`

**New response fields:**
```json
{
  "error": false,
  "data": {
    "payment_intent_id": "intent-uuid",
    "reference_id": "ref-uuid",
    "fiat_amount": 15000,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 2,
    "items_total": 14000,
    "delivery_fee": 1000,
    "discount_amount": 0,
    "delivery_address": { ... },
    "delivery_state": "Lagos",
    "assets": [ ... ],
    "items": [
      {
        "product_id": "product-uuid",
        "name": "Product A",
        "price": 7000,
        "currency": "NGN",
        "quantity": 1,
        "image": "https://res.cloudinary.com/...",
        "shop_id": "shop-uuid"
      },
      {
        "product_id": "product-uuid-2",
        "name": "Product B",
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

### 2.2 Guest Checkout

**Endpoint:** `POST /api/cart/checkout`

Same response shape as authenticated checkout, including the new `items` array.

### 2.3 Order History Already Returns Items

The `ShopOrderController` already reads items from `PaymentIntent.metadata.items`. No backend changes needed here. Ensure the frontend order detail view renders `metadata.items` which contains:

```json
{
  "items": [
    {
      "product_id": "product-uuid",
      "name": "Product A",
      "quantity": 2,
      "price": 5000
    }
  ]
}
```

---

## 3. Product Creation and Update with Images

### 3.1 Create Product

**Endpoint:** `POST /api/user/shop/products`

**JSON body with pre-uploaded images:**
```json
{
  "name": "My Product",
  "price": 5000,
  "description": "Product description",
  "category": "Electronics",
  "stock": 10,
  "track_stock": true,
  "variants": null,
  "product_type": "physical",
  "images": [
    { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product/abc123" }
  ]
}
```

**Multipart form data with direct upload:**
```
Content-Type: multipart/form-data

name=My Product
price=5000
description=Product description
category=Electronics
stock=10
images[]=file1.jpg
images[]=file2.jpg
```

When files are uploaded directly, the backend uploads them to Cloudinary under `wt-payments/shop-product-<uuid>/` and returns the Cloudinary URLs in the product response.

### 3.2 Update Product

**Endpoint:** `PUT /api/user/shop/products/:productId`

Same payload options as create.

**JSON body replaces all images:**
```json
{
  "name": "Updated Product",
  "price": 6000,
  "images": [
    { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product/xyz789" }
  ]
}
```

**Multipart body appends images:**
```
Content-Type: multipart/form-data

name=Updated Product
price=6000
images[]=new-file.jpg
```

### 3.3 Upload Images to Existing Product

**Endpoint:** `POST /api/user/shop/products/:productId/images`

**Multipart form data:**
```
Content-Type: multipart/form-data

images[]=file1.jpg
images[]=file2.jpg
```

**Response:**
```json
{
  "error": false,
  "data": {
    "images": [
      { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product/..." }
    ]
  },
  "message": "Images uploaded"
}
```

### 3.4 Delete Product Image

**Endpoint:** `DELETE /api/user/shop/products/:productId/images/:publicId`

The `publicId` must be URL-encoded if it contains special characters.

### 3.5 Image Object Shape

All image objects in responses follow this shape:

```json
{
  "url": "https://res.cloudinary.com/cloud-name/image/upload/v12345/wt-payments/shop-product/product-uuid/abc123.jpg",
  "publicId": "wt-payments/shop-product/product-uuid/abc123"
}
```

### 3.6 Image Limits

- Maximum **5 images per upload batch**.
- Maximum images per product is defined by the shop template feature `max_images_per_product` (default: check `SHOP_PRODUCT_FEATURES.MAX_IMAGES_PER_PRODUCT`).
- Allowed formats: `jpg`, `jpeg`, `png`, `webp`.
- Maximum file size: **5MB** per image for product images.

---

## 4. Wallet Balance Display

### 4.1 Multiple Wallets Per User

A user can now have multiple `UserWallet` records — one per network. The frontend must not treat balance as a single number.

**Endpoint:** `GET /api/user/wallets`

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

### 4.2 Dashboard Balance

**Endpoint:** `GET /api/dashboard/stats`

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

**Important:** This endpoint sums balances across all active wallets for the authenticated user.

### 4.3 SSE Balance Updates

**Endpoint:** `GET /api/user/stream` (SSE)

Listen for `wallet.balance_updated`:

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

**Frontend action:** Update each wallet card individually using the `wallets[]` array, not just the total.

### 4.4 Wallet Selector in Withdrawal Flow

When the user initiates a withdrawal, they must first select which wallet to withdraw from.

**Flow:**
1. Fetch `GET /api/user/wallets`
2. Show a wallet selector dropdown with:
   - Network name and logo
   - Wallet address (truncated)
   - Available balance
3. When a wallet is selected, send:
```json
POST /api/user/withdrawal/initiate
{
  "type": "crypto",
  "user_wallet_id": "selected-wallet-uuid",
  "amount": 50,
  "crypto_currency_id": "currency-uuid",
  "network_id": "network-uuid",
  "recipient_address": "0xAbC123..."
}
```

The backend will validate that `user_wallet_id` belongs to the authenticated user and that the balance is sufficient.

---

## 5. Available Assets Response

**Endpoint:** `GET /api/available-assets`

Now returns Solana and Tron networks alongside EVM networks.

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

**Key fields for frontend logic:**
- `network.networkType`: `"evm"`, `"ckb"`, `"solana"`, or `"tron"`
- `network.chainKey`: `"bsc"`, `"polygon"`, `"eth"`, `"base"`, `"ckb"`, `"solana"`, `"tron"`
- `network.chainId`: numeric for EVM, `null` for Solana/Tron
- `crypto.contractAddress`: mint/contract address for tokens, `null` for native currencies

### 5.1 Address Validation by Network

Use `networkType` or `chainKey` to validate recipient addresses:

| Network Type | Chain Key | Address Format | Example | Validation Regex |
|--------------|-----------|----------------|---------|------------------|
| `evm` | `bsc`, `polygon`, `eth`, `base` | `0x` + 40 hex chars | `0xAbC123...` | `/^0x[a-fA-F0-9]{40}$/` |
| `ckb` | `ckb` | CKB address | `ckb1q...` | Chain-specific |
| `solana` | `solana` | Base58, no `0x` | `7EcjQq5RXkq...` | `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/` |
| `tron` | `tron` | Base58 starting with `T` | `TQcZ9FqK9w8...` | `/^T[a-km-zA-HJ-NP-Z1-9]{33}$/` |

---

## 6. Withdrawal and Payout Changes

### 6.1 Withdrawal Initiate

**Endpoint:** `POST /api/user/withdrawal/initiate`

```json
{
  "type": "crypto",
  "user_wallet_id": "wallet-uuid",
  "amount": 50,
  "crypto_currency_id": "currency-uuid",
  "network_id": "network-uuid",
  "recipient_address": "TQcZ9FqK9w8fZ6fQo1J19w6dE6w8fZ6fQo1J19w6dE6"
}
```

**Response:**
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

### 6.2 Withdrawal Confirm

**Endpoint:** `POST /api/user/withdrawal/confirm`

```json
{
  "otp_id": "otp-uuid",
  "otp_code": "123456"
}
```

**Response:**
```json
{
  "result": {
    "status": "completed",
    "tx_hash": "abc123def456...",
    "transactionId": "tx-uuid"
  }
}
```

### 6.3 Withdrawal History

**Endpoint:** `GET /api/user/withdrawals/history`

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

**Endpoint:** `GET /api/user/payment-intent/history`

New `network` values: `"Solana"` and `"Tron"` are now possible.

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
        "created_at": "...",
        "completed_at": "..."
      }
    ]
  }
}
```

### 7.2 Transaction Record Shape (Receive Transactions)

Each receive transaction is now linked to a specific `UserWallet`:

```json
{
  "transaction_id": "tx-uuid",
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
```

---

## 8. SSE Events

### 8.1 Wallet Balance Updated

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

**Frontend action:** Update each wallet's balance individually using the `wallets` array. Do not rely solely on `total_balance_usd`.

### 8.2 Transaction Confirmed

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

### 8.3 Withdrawal Updated

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

---

## 9. Checkout Flow Changes

### 9.1 Checkout Now Returns Order Items

Both authenticated and guest checkout now include an `items` array in the response:

```json
{
  "payment_intent_id": "intent-uuid",
  "reference_id": "ref-uuid",
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
  ],
  "items_total": 14000,
  "delivery_fee": 1000,
  "discount_amount": 0,
  "assets": [ ... ]
}
```

### 9.2 Checkout Validation

The backend enforces that cart items must be from a single shop. If items from multiple shops are present, the backend returns:

```json
{
  "error": true,
  "message": "Checkout is limited to one shop at a time. Please clear your cart or checkout with items from a single shop."
}
```

---

## 10. Product Upload with Images

### 10.1 Create Product with Images

**Endpoint:** `POST /api/user/shop/products`

**JSON body:**
```json
{
  "name": "My Product",
  "price": 5000,
  "description": "Description",
  "category": "Electronics",
  "stock": 10,
  "track_stock": true,
  "images": [
    { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product/abc123" }
  ]
}
```

**Multipart form data:**
```
Content-Type: multipart/form-data

name=My Product
price=5000
description=Description
category=Electronics
stock=10
images[]=file1.jpg
images[]=file2.jpg
```

### 10.2 Update Product with Images

**Endpoint:** `PUT /api/user/shop/products/:productId`

Same payload options as create. JSON `images` array **replaces** all existing images. Multipart `images` files **append** to existing images.

### 10.3 Image Upload Endpoint

**Endpoint:** `POST /api/user/shop/products/:productId/images`

**Multipart form data:**
```
Content-Type: multipart/form-data

images[]=file1.jpg
images[]=file2.jpg
```

**Response:**
```json
{
  "error": false,
  "data": {
    "images": [
      { "url": "https://res.cloudinary.com/...", "publicId": "wt-payments/shop-product/..." }
    ]
  },
  "message": "Images uploaded"
}
```

### 10.4 Image Object Shape

All product images follow this shape:

```json
{
  "url": "https://res.cloudinary.com/cloud-name/image/upload/v12345/wt-payments/shop-product/product-uuid/abc123.jpg",
  "publicId": "wt-payments/shop-product/product-uuid/abc123"
}
```

### 10.5 Image Limits

| Constraint | Value |
|------------|-------|
| Max images per upload batch | 5 |
| Max images per product | Defined by shop template (`max_images_per_product`) |
| Allowed formats | `jpg`, `jpeg`, `png`, `webp` |
| Max file size | 5MB per image |

---

## 11. Summary of New/Changed Endpoints

| Method | Endpoint | Auth | New/Changed | Description |
|--------|----------|------|-------------|-------------|
| `GET` | `/api/cart?guest_token=<token>` | No | **New** | View guest cart |
| `POST` | `/api/cart/items` | No | **New** | Add to guest cart |
| `PUT` | `/api/cart/items/:itemId` | No | **New** | Update guest cart item |
| `DELETE` | `/api/cart/items/:itemId` | No | **New** | Remove guest cart item |
| `DELETE` | `/api/cart` | No | **New** | Clear guest cart |
| `POST` | `/api/cart/checkout` | No | **Changed** | Guest checkout now returns `items` |
| `POST` | `/api/user/cart/checkout` | Yes | **Changed** | Auth checkout now returns `items` |
| `POST` | `/api/user/shop/products` | Yes | **Changed** | Accepts `images` in JSON or multipart |
| `PUT` | `/api/user/shop/products/:productId` | Yes | **Changed** | Accepts `images` in JSON or multipart |
| `POST` | `/api/user/shop/products/:productId/images` | Yes | Unchanged | Upload images to existing product |
| `DELETE` | `/api/user/shop/products/:productId/images/:publicId` | Yes | Unchanged | Delete product image |
| `GET` | `/api/user/wallets` | Yes | Unchanged | Returns per-network wallets |
| `GET` | `/api/dashboard/stats` | Yes | Unchanged | Returns total wallet balance |
| `GET` | `/api/user/stream` | Yes | Unchanged | SSE — listen for `wallet.balance_updated` |
| `GET` | `/api/available-assets` | Yes | **Changed** | Now includes Solana/Tron networks |
| `POST` | `/api/user/withdrawal/initiate` | Yes | **Changed** | Requires `user_wallet_id` |
| `GET` | `/api/user/withdrawals/history` | Yes | Unchanged | Now includes `network` field |
| `GET` | `/api/user/payment-intent/history` | Yes | **Changed** | `network` may be `"Solana"` or `"Tron"` |

---

## 12. Frontend Action Items

### Immediate
- [ ] Implement guest cart flow with `guest_token` storage in `localStorage`
- [ ] Update checkout response handling to render `items` array
- [ ] Update product create/update forms to support image upload via multipart or JSON
- [ ] Update wallet dashboard to show per-network wallet cards instead of a single balance
- [ ] Add network-type-aware address validation for Solana (`/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`) and Tron (`/^T[a-km-zA-HJ-NP-Z1-9]{33}$/`)
- [ ] Update withdrawal form to include wallet selector dropdown before amount input
- [ ] Ensure `available-assets` dropdown groups by `networkType` and shows network logos

### Optional
- [ ] On user login, merge guest cart into user's authenticated cart (backend supports both simultaneously, but merge logic is not implemented)
- [ ] Add order detail page that renders `metadata.items` with product images
- [ ] Implement image preview/upload UI for product creation using multipart form data

# Shop, Cart, Checkout & Admin Settings API

Base path: `/api`

---

## Shop Management

### List all shops
```http
GET /api/user/shops
Authorization: Bearer <user_token>
```

### Get shop
```http
GET /api/user/shop?shop_id=<shop_uuid>
Authorization: Bearer <user_token>
```

### Create shop
```http
POST /api/user/shop
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "business_name": "My Store",
  "subdomain": "mystore",
  "description": "Optional description",
  "currency": "NGN"
}
```

### Update shop
```http
PUT /api/user/shop
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "business_name": "Updated Name",
  "description": "Updated description",
  "status": "published"
}
```

### Upload shop logo
```http
POST /api/user/shop/logo
Authorization: Bearer <user_token>
Content-Type: multipart/form-data

Form field: logo (image file, max 5MB, jpg/png/webp)
```

### Upload shop banner
```http
POST /api/user/shop/banner
Authorization: Bearer <user_token>
Content-Type: multipart/form-data

Form field: banner (image file, max 10MB, jpg/png/webp)
```

---

## Shop Products

### List products
```http
GET /api/user/shop/products?page=1&limit=20&category=Electronics&active=true
Authorization: Bearer <user_token>
```

### Create product
```http
POST /api/user/shop/products
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "name": "Product Name",
  "price": 5000,
  "description": "Optional description",
  "category": "Electronics",
  "stock": 100,
  "track_stock": true,
  "variants": null,
  "product_type": "physical"
}
```

### Update product
```http
PUT /api/user/shop/products/:productId
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "price": 6000,
  "description": "Updated description",
  "stock": 50,
  "is_active": true
}
```

### Delete product (soft delete)
```http
DELETE /api/user/shop/products/:productId
Authorization: Bearer <user_token>
```

### Upload product images
```http
POST /api/user/shop/products/:productId/images
Authorization: Bearer <user_token>
Content-Type: multipart/form-data

Form field: images (array of image files, max 5 per batch, 5MB each, jpg/png/webp)
```

### Delete product image
```http
DELETE /api/user/shop/products/:productId/images/:publicId
Authorization: Bearer <user_token>
```

---

## Cart

### Get cart
```http
GET /api/user/cart
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "error": false,
  "data": "Cart retrieved",
  "code": 200,
  "result": {
    "cart_id": "uuid",
    "items": [
      {
        "id": "cart_item_uuid",
        "product_id": "product_uuid",
        "name": "Product Name",
        "price": 5000,
        "currency": "NGN",
        "quantity": 2,
        "image": "https://cloudinary.com/...",
        "stock": 100,
        "is_active": true,
        "shop_id": "shop_uuid"
      }
    ],
    "total": 10000,
    "currency": "NGN",
    "item_count": 2
  }
}
```

### Add item to cart
```http
POST /api/user/cart/items
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "product_id": "product_uuid",
  "quantity": 1
}
```

**SSE Event Emitted:** `cart.item_added`

### Update cart item quantity
```http
PUT /api/user/cart/items/:itemId
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "quantity": 3
}
```

**SSE Event Emitted:** `cart.updated`

### Remove item from cart
```http
DELETE /api/user/cart/items/:itemId
Authorization: Bearer <user_token>
```

**SSE Event Emitted:** `cart.item_removed`

### Clear cart
```http
DELETE /api/user/cart
Authorization: Bearer <user_token>
```

**SSE Event Emitted:** `cart.cleared`

---

## Checkout

### Create checkout session from cart
```http
POST /api/user/cart/checkout
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "fiat_currency": "NGN",
  "payment_method": "crypto"
}
```

**`payment_method` options:**
- `crypto` — returns crypto payment assets
- `paystack` — returns Paystack authorization URL

**Response (crypto):**
```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 200,
  "result": {
    "payment_method": "crypto",
    "payment_intent_id": "uuid",
    "reference_id": "uuid",
    "fiat_amount": 10000,
    "fiat_currency": "NGN",
    "shop_id": "shop_uuid",
    "items_count": 2,
    "assets": [
      {
        "currency_id": "uuid",
        "name": "USDT",
        "symbol": "USDT",
        "logo": "https://...",
        "network": {
          "name": "Ethereum",
          "logo": "https://..."
        },
        "amount": 10000
      }
    ]
  }
}
```

**Response (paystack):**
```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 200,
  "result": {
    "payment_method": "paystack",
    "payment_intent_id": "uuid",
    "reference_id": "uuid",
    "authorization_url": "https://paystack.com/pay/...",
    "fiat_amount": 10000,
    "fiat_currency": "NGN",
    "shop_id": "shop_uuid",
    "items_count": 2
  }
}
```

**SSE Event Emitted:** `cart.checkout_completed`

**Email Sent:** `order_placed.html` to customer

---

## Payment Status

### Get payment status (public)
```http
GET /api/payment/status/:reference_id
```

### Stream payment status updates (SSE)
```http
GET /api/payment/status/:reference_id/stream
```

---

## Admin System Settings

### View system settings
```http
GET /api/admin/system-settings
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "error": false,
  "data": "System settings retrieved",
  "code": 200,
  "result": {
    "duration_per_transaction": 30,
    "platform_fee_percentage": 5
  }
}
```

### Update system settings
```http
PATCH /api/admin/system-settings
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "duration_per_transaction": 30,
  "platform_fee_percentage": 5
}
```

**Notes:**
- `platform_fee_percentage` controls the fee deducted from all incoming payments (default: 5%)
- `duration_per_transaction` controls payment window in minutes

---

## SSE Events

Connect to:
```http
GET /api/user/stream
Authorization: Bearer <user_token>
```

### Cart Events
| Event | Description |
|---|---|
| `cart.item_added` | Product added to cart |
| `cart.item_removed` | Product removed from cart |
| `cart.updated` | Cart item quantity updated |
| `cart.cleared` | All items cleared |
| `cart.checkout_completed` | Payment intent created from cart |

### Order/Payment Events
| Event | Description |
|---|---|
| `order.payment_received` | Payment confirmed for an order |
| `payment.completed` | Payment completed |
| `transaction.confirmed` | Blockchain transaction confirmed |
| `wallet.balance_updated` | Wallet balance changed |

### SSE Event Formats

**cart.item_added:**
```json
{
  "product_id": "uuid",
  "quantity": 2,
  "product_name": "Product Name",
  "cart_id": "uuid"
}
```

**cart.checkout_completed:**
```json
{
  "payment_method": "crypto",
  "reference_id": "uuid",
  "fiat_amount": 10000,
  "fiat_currency": "NGN",
  "assets": 3
}
```

**order.payment_received:**
```json
{
  "payment_intent_id": "uuid",
  "reference_id": "uuid",
  "fiat_amount": 10000,
  "fiat_currency_id": "uuid",
  "status": "completed",
  "completed_at": "2026-07-15T13:00:00Z"
}
```

---

## Email Notifications

| Template | Trigger |
|---|---|
| `order_placed.html` | Cart checkout completed |
| `payment_received.html` | Payment confirmed |
| `payment_processing.html` | Payment detected, awaiting confirmations |
| `payment_confirmation.html` | Payment fully confirmed |
| `transfer_completed.html` | Crypto/fiat transfer completed |
| `transfer_failed.html` | Transfer failed |
| `withdrawal_otp.html` | Withdrawal OTP sent |
| `withdrawal_success.html` | Withdrawal processed |
| `admin_payment_received.html` | Admin notified of new payment |
| `admin_payment_notification.html` | Admin payment alert |

---

## Checkout Flow Diagrams

### Crypto Checkout Flow
```
Frontend: POST /api/user/cart/checkout { payment_method: "crypto" }
    ↓
Backend: Creates PaymentIntent
    ↓
Returns: reference_id + assets (crypto currencies + amounts)
    ↓
Frontend: Customer selects crypto currency
    ↓
Frontend: POST /api/pay/:slug/wallet { reference_id, crypto_currency_id }
    ↓
Backend: Returns wallet address + amount
    ↓
Customer sends crypto to wallet address
    ↓
Blockchain indexer detects payment
    ↓
POST /api/webhooks/payment → PaymentIndexerService
    ↓
SSE: order.payment_received emitted
Email: payment_received.html sent
```

### Paystack Checkout Flow
```
Frontend: POST /api/user/cart/checkout { payment_method: "paystack" }
    ↓
Backend: Creates PaymentIntent + Paystack charge
    ↓
Returns: authorization_url
    ↓
Frontend: Redirects customer to Paystack hosted page
    ↓
Customer pays via card/bank/transfer
    ↓
Paystack: POST /api/webhooks/paystack/deposit { event: "charge.success" }
    ↓
Backend: Verifies signature, processes deposit
    ↓
SSE: order.payment_received emitted
Email: order_placed.html + payment confirmation sent
```

---

## Environment Variables Required

```env
# Platform fee (admin-configurable via API, this is fallback)
PLATFORM_FEE_PERCENTAGE=5

# Cart/checkout
SHOP_BASE_DOMAIN=wt-payments-frontend.vercel.app

# Paystack (for fiat checkout and payouts)
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_BASE_URL=https://api.paystack.co

# Email notifications
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=no-reply@example.com
EMAIL_PASS=<password>
EMAIL_FROM_NAME=WT Payments
EMAIL_FROM_EMAIL=no-reply@example.com
```

---

## Migrations to Run

```bash
node ace migration:run
```

New migrations:
- `20260715160000_create_carts`
- `20260715160001_create_cart_items`
- `20260715180000_add_platform_fee_to_system_settings`

---

## Notes

- All cart endpoints require `auth:user` middleware
- All admin settings endpoints require `auth:admin` middleware
- Cart is limited to one shop at a time during checkout
- Product stock is validated before adding to cart
- Platform fee is deducted from all incoming payments and can be changed by admin at any time
- SSE events keep cart synced across browser tabs without polling
- Email notifications are non-blocking — failures are logged but don't fail the API response

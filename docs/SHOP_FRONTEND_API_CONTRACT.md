# Shop Frontend API Contract

Base URL: `https://your-api.example.com`

All JSON endpoints return JSON. Authenticated endpoints require:

```http
Authorization: Bearer <user_token>
Content-Type: application/json
```

## Response conventions

Most authenticated endpoints use:

```json
{
  "error": false,
  "data": "Human-readable message",
  "code": 200,
  "result": {}
}
```

Public storefront endpoints return the result in `data` without `result`:

```json
{
  "error": false,
  "data": {}
}
```

Typical errors:

```json
{
  "error": true,
  "data": "name is required.",
  "details": "name is required.",
  "code": 400
}
```

Authentication error:

```json
{
  "error": true,
  "data": "Unauthorized access. Please sign in again.",
  "details": "...",
  "code": 401
}
```

Not found:

```json
{
  "error": true,
  "data": "Resource not found!",
  "details": "...",
  "code": 404
}
```

---

## 1. Customer storefront

### Get a storefront

```http
GET /api/storefront/:subdomain
```

No authentication required.

Example:

```http
GET /api/storefront/bitgadgetz
```

Success `200`:

```json
{
  "error": false,
  "data": {
    "id": "shop-uuid",
    "business_name": "BitGadgetz",
    "subdomain": "bitgadgetz",
    "description": "Useful products",
    "logo_url": "https://...",
    "banner_url": "https://...",
    "theme_config": {},
    "currency": "NGN",
    "status": "published",
    "checkout_url": "/api/pay/pl_abc123",
    "payment_link_id": "payment-link-uuid",
    "products": [
      {
        "id": "product-uuid",
        "name": "Wireless Headphones",
        "price": 45000,
        "currency": "NGN",
        "description": "Bluetooth headphones",
        "category": "electronics",
        "images": [
          { "url": "https://.../image-1.jpg", "publicId": "shops/image-1" },
          { "url": "https://.../image-2.jpg", "publicId": "shops/image-2" }
        ],
        "stock": 12,
        "track_stock": true,
        "variants": null
      }
    ]
  }
}
```

Error `404`:

```json
{
  "error": true,
  "message": "Shop not found"
}
```

### Get a product detail page

Use this endpoint when a customer clicks a product card. The `images` array can be used by the frontend slideshow/carousel.

```http
GET /api/storefront/:subdomain/products/:productId
```

No authentication required.

Success `200`:

```json
{
  "error": false,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "business_name": "BitGadgetz",
      "subdomain": "bitgadgetz",
      "currency": "NGN",
      "logo_url": "https://..."
    },
    "product": {
      "id": "product-uuid",
      "name": "Wireless Headphones",
      "description": "Full product description here.",
      "price": 45000,
      "currency": "NGN",
      "category": "electronics",
      "images": [
        { "url": "https://.../image-1.jpg", "publicId": "shops/image-1" },
        { "url": "https://.../image-2.jpg", "publicId": "shops/image-2" }
      ],
      "stock": 12,
      "track_stock": true,
      "variants": {
        "color": ["black", "white"]
      }
    }
  }
}
```

Error `404`:

```json
{
  "error": true,
  "data": "Resource not found!",
  "details": "...",
  "code": 404
}
```

### Public delivery settings

```http
GET /api/shop/:subdomain/delivery-settings
```

No authentication required.

Success `200`:

```json
{
  "error": false,
  "data": "Delivery settings retrieved",
  "code": 200,
  "result": {
    "has_free_delivery": false,
    "delivery_fee": 2500,
    "delivery_zones": { "Lagos": 2500, "Abuja": 4000 },
    "discount_percentage": 0,
    "discount_amount": 0,
    "promo_code": "WELCOME10",
    "free_delivery_threshold": 50000
  }
}
```

---

## 2. Shop owner: shop administration

All endpoints in this section require the owner user token.

### Get current shop

```http
GET /api/user/shop
```

Optional query: `?shop_id=<shop-uuid>`

Success `200` returns a shop object containing `id`, `business_name`, `shop_url`, `storefront_url`, `checkout_url`, `logo_url`, `banner_url`, `theme_config`, `pages_config`, `status`, `currency`, `features`, and `payment_gateway`.

If the user has no shop:

```json
{
  "error": false,
  "data": "No shop found",
  "code": 200,
  "result": null
}
```

### List shops

```http
GET /api/user/shops
GET /api/user/shop/all
GET /api/user/shop/shops
```

Success `200`:

```json
{
  "error": false,
  "data": "Shops retrieved",
  "code": 200,
  "result": [/* shop objects */]
}
```

### Create a shop

```http
POST /api/user/shop
```

Payload:

```json
{
  "business_name": "BitGadgetz",
  "subdomain": "bitgadgetz",
  "description": "Useful products",
  "currency": "NGN",
  "template": "yanga-default",
  "shop_type": "default",
  "theme_config": {},
  "pages_config": {},
  "features": {}
}
```

Required: `business_name`, `subdomain`.

Success `200`:

```json
{
  "error": false,
  "data": "Shop created successfully",
  "code": 200,
  "result": { "id": "shop-uuid", "business_name": "BitGadgetz" }
}
```

Errors:

```json
{ "error": true, "data": "business_name is required.", "code": 400 }
```

```json
{ "error": true, "data": "Subdomain \"bitgadgetz\" is already taken.", "code": 400 }
```

### Update a shop

```http
PUT /api/user/shop
```

Payload fields are optional:

```json
{
  "business_name": "New Shop Name",
  "description": "Updated description",
  "currency": "USD",
  "status": "published",
  "features": {},
  "theme_config": {},
  "pages_config": {}
}
```

`status` must be `draft` or `published`.

Success `200`:

```json
{
  "error": false,
  "data": "Shop updated",
  "code": 200,
  "result": { "id": "shop-uuid" }
}
```

### Upload logo or banner

```http
POST /api/user/shop/logo
POST /api/user/shop/banner
```

Use `multipart/form-data`:

- Logo field: `logo`
- Banner field: `banner`
- Accepted types: jpg, jpeg, png, webp
- Logo maximum: 5 MB
- Banner maximum: 10 MB

Success logo response:

```json
{
  "error": false,
  "data": "Logo uploaded",
  "code": 200,
  "result": { "logo_url": "https://..." }
}
```

Errors:

```json
{ "error": true, "data": "logo file is required.", "code": 400 }
```

---

## 3. Shop owner: products and images

### List products

```http
GET /api/user/shop/products?page=1&limit=20&category=electronics&active=true
```

Success `200`:

```json
{
  "error": false,
  "data": "Products retrieved",
  "code": 200,
  "result": {
    "meta": { "total": 1, "perPage": 20, "currentPage": 1, "lastPage": 1 },
    "data": [/* product objects */]
  }
}
```

### Create a product

```http
POST /api/user/shop/products
```

Payload:

```json
{
  "name": "Wireless Headphones",
  "price": 45000,
  "description": "Bluetooth headphones",
  "category": "electronics",
  "stock": 12,
  "track_stock": true,
  "product_type": "physical",
  "variants": {
    "color": ["black", "white"]
  }
}
```

Required: `name`, `price`.

Success `200`:

```json
{
  "error": false,
  "data": "Product created",
  "code": 200,
  "result": {
    "uniqueId": "product-uuid",
    "name": "Wireless Headphones",
    "price": 45000,
    "currency": "NGN",
    "stock": 12,
    "isActive": true,
    "images": []
  }
}
```

Errors include:

```json
{ "error": true, "data": "name is required.", "code": 400 }
```

```json
{ "error": true, "data": "price must be a number.", "code": 400 }
```

```json
{ "error": true, "data": "Product type \"digital\" is not allowed for this shop. Allowed: ...", "code": 400 }
```

### Update a product

```http
PUT /api/user/shop/products/:productId
```

Payload fields are optional:

```json
{
  "name": "Updated name",
  "price": 48000,
  "description": "Updated description",
  "category": "electronics",
  "stock": 10,
  "track_stock": true,
  "variants": null,
  "is_active": true
}
```

Success: same product object in `result`, with `data: "Product updated"`.

### Remove a product

```http
DELETE /api/user/shop/products/:productId
```

This is a soft delete: the product becomes inactive.

Success:

```json
{
  "error": false,
  "data": "Product removed",
  "code": 200,
  "result": null
}
```

### Upload product images

```http
POST /api/user/shop/products/:productId/images
```

Use `multipart/form-data` with one or more fields named `images`.

Limits: jpg, jpeg, png, webp; maximum 5 MB per file; maximum 5 files per upload; the shop template controls the total images per product.

Success:

```json
{
  "error": false,
  "data": "Images uploaded",
  "code": 200,
  "result": {
    "images": [
      { "url": "https://...", "publicId": "shops/product-image-1" }
    ]
  }
}
```

Errors:

```json
{ "error": true, "data": "At least one image is required.", "code": 400 }
```

```json
{ "error": true, "data": "Maximum 5 images per upload batch.", "code": 400 }
```

### Delete a product image

```http
DELETE /api/user/shop/products/:productId/images/:publicId
```

URL-encode `publicId` before placing it in the URL.

Success:

```json
{
  "error": false,
  "data": "Image deleted",
  "code": 200,
  "result": { "images": [] }
}
```

---

## 4. Shop owner: delivery settings

### Get delivery settings

```http
GET /api/user/shop/delivery-settings
```

Success returns the same delivery settings object shown in the public endpoint.

### Update delivery settings

```http
PUT /api/user/shop/delivery-settings
```

Payload:

```json
{
  "has_free_delivery": false,
  "delivery_fee": 2500,
  "delivery_zones": {
    "Lagos": 2500,
    "Abuja": 4000
  },
  "discount_percentage": 10,
  "discount_amount": 0,
  "promo_code": "WELCOME10",
  "free_delivery_threshold": 50000
}
```

Success:

```json
{
  "error": false,
  "data": "Delivery settings updated",
  "code": 200,
  "result": {
    "has_free_delivery": false,
    "delivery_fee": 2500,
    "delivery_zones": { "Lagos": 2500 },
    "discount_percentage": 10,
    "discount_amount": 0,
    "promo_code": "WELCOME10",
    "free_delivery_threshold": 50000
  }
}
```

---

## 5. Shop owner: orders and dashboard charts

### List orders

```http
GET /api/user/shop/orders?page=1&limit=20&status=pending
```

`status` values: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.

Success:

```json
{
  "error": false,
  "data": "Orders retrieved",
  "code": 200,
  "result": {
    "meta": { "total": 1, "perPage": 20, "currentPage": 1, "lastPage": 1 },
    "data": [
      {
        "id": "payment-intent-uuid",
        "reference_id": "ORDER-1001",
        "payment_status": "payment_completed",
        "order_status": "pending",
        "amount": 45000,
        "currency": "NGN",
        "customer": {
          "id": "customer-uuid",
          "email": "customer@example.com",
          "phone": "2348012345678"
        },
        "items": [
          { "product_id": "product-uuid", "name": "Wireless Headphones", "quantity": 1, "price": 45000 }
        ],
        "delivery_address": {
          "full_name": "Customer Name",
          "phone": "08012345678",
          "address": "1 Example Street",
          "city": "Lagos",
          "state": "Lagos",
          "country": "Nigeria"
        },
        "delivery_state": "Lagos",
        "created_at": "2026-09-14T10:00:00.000+00:00",
        "paid_at": "2026-09-14T10:05:00.000+00:00",
        "updated_at": "2026-09-14T10:05:00.000+00:00"
      }
    ]
  }
}
```

### Get one order

```http
GET /api/user/shop/orders/:orderId
```

Success uses the same order object as the list endpoint.

### Update order status

```http
PATCH /api/user/shop/orders/:orderId/status
```

Payload:

```json
{
  "status": "shipped"
}
```

Success:

```json
{
  "error": false,
  "data": "Order status updated",
  "code": 200,
  "result": {
    "id": "payment-intent-uuid",
    "order_status": "shipped"
  }
}
```

Invalid status error:

```json
{
  "error": true,
  "data": "status must be one of: pending, processing, shipped, delivered, cancelled",
  "code": 400
}
```

### Get dashboard analytics

```http
GET /api/user/shop/orders/analytics?from=2026-09-01&to=2026-09-14
```

Dates are optional. Default range is the last 30 days.

Success:

```json
{
  "error": false,
  "data": "Shop analytics retrieved",
  "code": 200,
  "result": {
    "from": "2026-09-01T00:00:00.000+00:00",
    "to": "2026-09-14T23:59:59.999+00:00",
    "total_orders": 12,
    "total_revenue": 650000,
    "by_status": {
      "pending": { "count": 3, "amount": 120000 },
      "processing": { "count": 2, "amount": 90000 },
      "shipped": { "count": 4, "amount": 240000 },
      "delivered": { "count": 3, "amount": 200000 }
    }
  }
}
```

The frontend can use `by_status` for order-status charts and `total_revenue` for revenue cards. The current endpoint returns status aggregates, not a daily time series.

---

## 6. Checkout payload required for orders and notifications

For authenticated cart checkout:

```http
POST /api/user/cart/checkout
```

For guest checkout:

```http
POST /api/cart/checkout
```

Example payload:

```json
{
  "fiat_currency": "NGN",
  "payment_method": "crypto",
  "customer_email": "customer@example.com",
  "customer_phone": "08012345678",
  "delivery_address": {
    "full_name": "Customer Name",
    "phone": "08012345678",
    "address": "1 Example Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "delivery_state": "Lagos",
  "promo_code": "WELCOME10"
}
```

The backend stores order items, delivery address, customer email, and customer phone with the payment intent. After payment is confirmed, it sends the customer confirmation email and, when WhatsApp credentials are configured, a WhatsApp confirmation.

---

## 7. Notification environment variables

The backend WhatsApp integration requires these server-side variables. Do not expose them in frontend code:

```env
WHATSAPP_ACCESS_TOKEN=<Meta WhatsApp Cloud API token>
WHATSAPP_PHONE_NUMBER_ID=<Meta phone number ID>
WHATSAPP_API_VERSION=v20.0
WHATSAPP_ORDER_TEMPLATE=<approved WhatsApp template name, optional>
WHATSAPP_TEMPLATE_LANGUAGE=en_US
```

Email is sent by the backend mail configuration. Notifications happen only after payment confirmation, and notification failures do not cancel or reverse a completed payment.

## Frontend implementation summary

- Storefront card click: navigate to `/shop/:subdomain/product/:productId`, then call the product detail endpoint.
- Slideshow source: `data.product.images`.
- Product purchase action: use the checkout endpoint and include `customer_email`, phone, and delivery details.
- Owner dashboard orders table: use the orders endpoint and `status` filter.
- Status controls: call the PATCH status endpoint.
- Revenue/order charts: use the analytics endpoint.
- Upload controls: send `multipart/form-data` to the product image endpoint.

---

## 8. Shop payment methods

The customer chooses one of these methods at checkout:

1. `paystack` for card, bank transfer, USSD, and other Paystack-supported fiat channels.
2. `crypto` for a selected crypto currency and its configured network, including CKB/Fiber where enabled.

The backend confirms payment server-side. The frontend must not mark an order as paid from the Paystack redirect alone or from a wallet address being displayed.

### Paystack checkout

Authenticated cart:

```http
POST /api/user/cart/checkout
Authorization: Bearer <user_token>
```

Guest cart:

```http
POST /api/cart/checkout
```

Payload for an authenticated customer:

```json
{
  "payment_method": "paystack",
  "fiat_currency": "NGN",
  "delivery_address": {
    "full_name": "Customer Name",
    "phone": "08012345678",
    "address": "1 Example Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "delivery_state": "Lagos",
  "promo_code": "WELCOME10"
}
```

Guest payload additionally requires the cart items and customer email:

```json
{
  "payment_method": "paystack",
  "customer_email": "customer@example.com",
  "fiat_currency": "NGN",
  "items": [
    {
      "product_id": "product-uuid",
      "name": "Wireless Headphones",
      "quantity": 1,
      "price": 45000,
      "shopId": "shop-uuid"
    }
  ],
  "delivery_address": {
    "full_name": "Customer Name",
    "phone": "08012345678",
    "address": "1 Example Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "delivery_state": "Lagos"
}
```

Success `200`:

```json
{
  "error": false,
  "data": "Checkout session created",
  "code": 200,
  "result": {
    "payment_method": "paystack",
    "payment_intent_id": "payment-intent-uuid",
    "reference_id": "order-reference",
    "authorization_url": "https://checkout.paystack.com/...",
    "fiat_amount": 47500,
    "fiat_currency": "NGN",
    "shop_id": "shop-uuid",
    "items_count": 1,
    "items_total": 45000,
    "delivery_fee": 2500,
    "discount_amount": 0,
    "delivery_address": {},
    "delivery_state": "Lagos"
  }
}
```

Open `authorization_url` in the browser. Paystack sends the signed `charge.success` webhook to:

```http
POST /api/webhooks/paystack/deposit
```

The backend then verifies the amount, marks the payment intent `payment_completed`, converts the fiat amount to USDT using the configured rate, credits the shop owner's active USDT revenue wallet, and sends customer email/WhatsApp notifications. Webhook retries are idempotent.

Payment errors:

```json
{ "error": true, "data": "Failed to initialize Paystack charge", "code": 500 }
```

```json
{ "error": true, "data": "Your cart is empty.", "code": 400 }
```

The frontend should display a pending state after returning from Paystack and poll the payment status endpoint using the payment intent ID until `payment_completed` or a failure/timeout is reached.

### Crypto checkout

Create the checkout session using the same cart endpoint, but set:

```json
{ "payment_method": "crypto", "fiat_currency": "NGN" }
```

The response includes `assets`. Display each crypto asset's `currency_id`, `symbol`, `network`, and calculated `amount`. The user chooses one asset, then request a receiving address.

Authenticated cart:

```http
POST /api/user/cart/wallet
Authorization: Bearer <user_token>
```

Payload:

```json
{
  "payment_intent_id": "payment-intent-uuid",
  "crypto_currency_id": "currency-uuid"
}
```

Guest cart:

```http
POST /api/cart/wallet
```

Payload:

```json
{
  "reference_id": "order-reference",
  "crypto_currency_id": "currency-uuid"
}
```

Success `200`:

```json
{
  "error": false,
  "data": {
    "payment_intent_id": "payment-intent-uuid",
    "transaction_id": "transaction-uuid",
    "expires_at": "2026-09-14T11:00:00.000+00:00",
    "fee_in_crypto": 0,
    "wallet": {
      "address": "ckb1... or fiber1...",
      "qr_code": "data:image/png;base64,..."
    },
    "fiat": {
      "name": "Nigerian Naira",
      "symbol": "NGN",
      "amount": 47500
    },
    "crypto": {
      "name": "CKB",
      "symbol": "CKB",
      "amount": 123.45,
      "network": {
        "name": "Nervos CKB Mainnet",
        "logo": "https://..."
      }
    }
  },
  "message": "Payment initiated successfully"
}
```

For a Fiber/CKB currency, the returned address may be a Fiber invoice address. The frontend should show the address, QR code, amount, network, and expiration. Do not assume an ordinary CKB address when `message` says `Fiber invoice created successfully`.

Payment confirmation is performed by the backend indexer/Fiber invoice service. The frontend should poll:

```http
GET /api/payment/status/:reference_id
```

and/or listen to the authenticated user's SSE stream for `order.payment_received` and `transaction.confirmed` events. Once confirmed, the backend sends order notifications.

Crypto errors:

```json
{ "error": true, "data": "payment_intent_id is required", "code": 400 }
```

```json
{ "error": true, "data": "crypto_currency_id is required", "code": 400 }
```

```json
{ "error": true, "data": "Invalid crypto currency", "code": 400 }
```

```json
{ "error": true, "data": "Crypto network not found", "code": 400 }
```

### CKB and CCC wallet connection

CCC is the CKB wallet authentication layer, not the payment confirmation mechanism. A customer can connect a CKB wallet with:

```http
POST /api/user/auth/ccc/challenge
POST /api/user/auth/ccc/verify
```

Challenge payload:

```json
{
  "provider": "ccc",
  "network": "mainnet",
  "subject": "ccc-canonical-identity-subject"
}
```

Verify payload:

```json
{
  "challengeId": "challenge-uuid",
  "provider": "ccc",
  "network": "mainnet",
  "subject": "ccc-canonical-identity-subject",
  "identity": "ccc-canonical-identity-subject",
  "signature": "0x...",
  "signType": "...",
  "address": "ckb1...",
  "lockScript": "...",
  "publicKey": "..."
}
```

The configured CKB/CCC application network is mainnet. If the wallet sends `testnet`, the API returns:

```json
{
  "error": true,
  "data": "Wallet network does not match the configured application network (received: testnet, expected: mainnet)",
  "code": 400
}
```

CCC authentication proves wallet ownership and links the identity to the user. The crypto checkout wallet/invoice returned by `/api/user/cart/wallet` is still the address that must receive the payment. Payment is marked confirmed only after the backend observes and verifies the on-chain or Fiber payment.

### Payment status response

```http
GET /api/payment-status/:payment_intent_id
```

Use `status` to drive the checkout UI. Relevant values are:

- `payment_created`: checkout created, payment not received.
- `awaiting_confirmation`: payment detected and being confirmed.
- `payment_completed`: payment confirmed and order notifications triggered.

Do not show the order as paid while the status is `payment_created` or `awaiting_confirmation`.

### Backend configuration required

```env
PAYSTACK_SECRET_KEY=<Paystack secret key>
CKB_NETWORK=mainnet
CCC_NETWORK=mainnet
CKB_MAINNET_RPC=https://mainnet.ckb.dev/rpc
WHATSAPP_ACCESS_TOKEN=<Meta WhatsApp Cloud API token>
WHATSAPP_PHONE_NUMBER_ID=<Meta phone number ID>
```

Paystack must be configured to send `charge.success` events to `/api/webhooks/paystack/deposit`. The shop owner's active USDT revenue wallet must exist before a Paystack order can be credited.

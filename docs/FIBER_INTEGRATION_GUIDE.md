# Fiber Payment API — Integration Reference

**Base URL (Dev):** `http://localhost:3333`  
**Base URL (Prod):** `https://api.your-platform.com`  
**Auth:** All endpoints require `Authorization: Bearer <token>` unless marked public.

---

## Quick Overview

| # | What the frontend needs to do | Endpoint |
|---|-------------------------------|----------|
| 1 | Create a payment intent (get wallet address + QR) | `POST /api/user/payment-intent/create-wallet` |
| 2 | List payment history for customer | `GET /api/user/payment-intent/history` |
| 3 | Enable Fiber for a business | `POST /api/business/fiber/setup` |
| 4 | Get business Fiber config | `GET /api/business/fiber/setup` |
| 5 | Update settlement settings | `PATCH /api/business/fiber/settlement` |
| 6 | List available tokens (RUSD, FIBB…) | `GET /api/business/fiber/available-sudt` |
| 7 | Add a token to accepted list | `POST /api/business/fiber/accept-sudt` |
| 8 | Remove token from accepted list | `DELETE /api/business/fiber/accept-sudt/:typeScript` |
| 9 | List business's accepted tokens | `GET /api/business/fiber/accepted-sudt` |
| 10 | View settled payment history | `GET /api/business/fiber/payments` |
| 11 | View stats / dashboard numbers | `GET /api/business/fiber/stats` |
| 12 | Disable Fiber | `POST /api/business/fiber/disable` |

---

## Authentication

```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "business@example.com",
  "password": "yourpassword"
}
```

**Response 200:**
```json
{
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "unique_id": "usr_abc123",
      "email": "business@example.com",
      "business_name": "Acme Store"
    }
  }
}
```

All subsequent requests use:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 1. Create Payment Intent (Generate Invoice / Wallet Address)

```
POST /api/user/payment-intent/create-wallet
Authorization: Bearer <token>
```

**Request:**
```json
{
  "crypto_currency_id": "CKB",
  "reference_id": "order_abc123"
}
```

> To use a SUDT token (e.g. RUSD), pass its symbol as `crypto_currency_id`:
```json
{
  "crypto_currency_id": "RUSD",
  "reference_id": "order_abc123"
}
```

**Response 200:**
```json
{
  "error": false,
  "message": "Wallet created successfully",
  "data": {
    "reference_id": "order_abc123",
    "payment_intent_id": "pi_xyz789",
    "expiration_time": "2026-07-10T13:00:00.000Z",
    "fee_in_crypto": 2000.00,
    "wallet": {
      "address": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg...",
      "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    },
    "fiat": {
      "amount": 100.00,
      "currency": "USD"
    },
    "crypto": {
      "symbol": "CKB",
      "network": "Fiber Testnet",
      "amount": 2000.00
    }
  }
}
```

**Key fields to use in UI:**
- `wallet.address` → show as text + copy button  
- `wallet.qr_code` → use as `<img src={qr_code} />`  
- `fee_in_crypto` → "Send exactly 2000 CKB"  
- `expiration_time` → countdown timer  

**Errors:**
```json
{ "error": true, "message": "Fiber not enabled for this business" }
{ "error": true, "message": "Unsupported crypto currency" }
{ "error": true, "message": "Failed to create Fiber invoice" }
```

---

## 2. Payment Intent History (Customer View)

```
GET /api/user/payment-intent/history
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "message": "Transaction history",
  "data": [
    {
      "unique_id": "pi_xyz789",
      "reference_id": "order_abc123",
      "status": "PAYMENT_COMPLETED",
      "fiat_amount": 100.00,
      "fiat_currency": "USD",
      "crypto_amount": 2000.00,
      "crypto_currency": "CKB",
      "created_at": "2026-07-10T12:00:00.000Z",
      "completed_at": "2026-07-10T12:01:43.000Z"
    }
  ]
}
```

**Status values:**
| Status | Meaning |
|--------|---------|
| `PAYMENT_CREATED` | Invoice created, waiting for payment |
| `AWAITING_CONFIRMATION` | Payment detected, settling |
| `PAYMENT_COMPLETED` | Fully settled ✅ |
| `PAYMENT_FAILED` | Failed |
| `PAYMENT_EXPIRED` | Invoice expired (30 min) |

---

## 3. Enable Fiber for Business

```
POST /api/business/fiber/setup
Authorization: Bearer <token>
```

> Only business accounts can call this. The account must have `business_name` set.

**Request:**
```json
{
  "accept_ckb": true,
  "accept_sudt": true,
  "min_channel_balance": 0.5
}
```

**Parameters:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `accept_ckb` | boolean | No | `true` | Accept CKB payments |
| `accept_sudt` | boolean | No | `true` | Accept SUDT token payments (RUSD, FIBB…) |
| `min_channel_balance` | number | No | `0.5` | Min CKB to keep in Fiber channel |

**Response 200:**
```json
{
  "message": "Fiber payments enabled successfully",
  "data": {
    "unique_id": "fbs_abc123",
    "business_id": "usr_abc123",
    "channel_id": "ckt1q...",
    "peer_id": "0x1234...",
    "accept_ckb": true,
    "accept_sudt": true,
    "status": "active",
    "created_at": "2026-07-10T12:00:00.000Z"
  }
}
```

**Errors:**
```json
{ "error": true, "message": "Only businesses can enable Fiber payments" }
{ "error": true, "message": "Fiber already enabled for this business" }
{ "error": true, "message": "Unable to connect to Fiber node" }
```

---

## 4. Get Business Fiber Config

```
GET /api/business/fiber/setup
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "message": "Fiber settings retrieved",
  "data": {
    "enabled": true,
    "channel_id": "ckt1q...",
    "peer_id": "0x1234...",
    "accept_ckb": true,
    "accept_sudt": true,
    "min_channel_balance": 0.5,
    "auto_convert_daily": false,
    "auto_convert_threshold": 10,
    "settlement_schedule": "manual",
    "total_received_ckb": 5000.00,
    "total_converted_usd": 250.00,
    "created_at": "2026-07-10T12:00:00.000Z",
    "channel_info": {
      "local_balance_ckb": 800.00,
      "remote_balance_ckb": 200.00,
      "state": "ChannelReady"
    },
    "payment_methods": [
      { "symbol": "CKB", "name": "Nervos CKB", "enabled": true },
      { "symbol": "RUSD", "name": "Reserve USD", "enabled": true }
    ]
  }
}
```

**Response 404 (Fiber not set up yet):**
```json
{
  "error": true,
  "message": "Fiber not enabled for this business"
}
```

---

## 5. Update Settlement Preferences

```
PATCH /api/business/fiber/settlement
Authorization: Bearer <token>
```

**Request:**
```json
{
  "auto_convert_daily": true,
  "auto_convert_threshold": 500,
  "settlement_schedule": "daily"
}
```

**Parameters (all optional):**
| Field | Type | Description | Options |
|-------|------|-------------|---------|
| `auto_convert_daily` | boolean | Auto-convert accumulated CKB to USDT daily | - |
| `auto_convert_threshold` | number | Min CKB before converting | Any number |
| `settlement_schedule` | string | How often to settle | `daily`, `weekly`, `manual` |

**Response 200:**
```json
{
  "message": "Settlement preferences updated",
  "data": {
    "auto_convert_daily": true,
    "auto_convert_threshold": 500,
    "min_channel_balance": 0.5,
    "settlement_schedule": "daily",
    "updated_at": "2026-07-10T12:05:00.000Z"
  }
}
```

---

## 6. List Available SUDT Tokens (Public)

```
GET /api/business/fiber/available-sudt
```

> No auth required. Returns all tokens in the global registry.

**Response 200:**
```json
{
  "message": "Available SUDT tokens",
  "data": [
    {
      "symbol": "RUSD",
      "name": "Reserve USD",
      "type_script": "{\"code_hash\":\"0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a\",\"hash_type\":\"type\",\"args\":\"0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b\"}",
      "logo": "https://raw.githubusercontent.com/stablepp/assets/main/rusd.png",
      "network": "testnet"
    },
    {
      "symbol": "FIBB",
      "name": "Fiber Token (Testnet)",
      "type_script": "{\"code_hash\":\"0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95\",\"hash_type\":\"data1\",\"args\":\"0x\"}",
      "logo": "https://raw.githubusercontent.com/nervosnetwork/fiber/main/assets/fibb.png",
      "network": "testnet"
    }
  ]
}
```

> The `type_script` value is a JSON string. When you send it back in `accept-sudt`, send the full string exactly as received.

---

## 7. Enable a SUDT Token for Business

```
POST /api/business/fiber/accept-sudt
Authorization: Bearer <token>
```

**Request:**
```json
{
  "type_script": "{\"code_hash\":\"0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a\",\"hash_type\":\"type\",\"args\":\"0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b\"}"
}
```

> Copy `type_script` directly from `GET /api/business/fiber/available-sudt`. Send the whole string.

**Response 200:**
```json
{
  "message": "SUDT token enabled for business",
  "data": {
    "symbol": "RUSD",
    "type_script": "{\"code_hash\":\"0x1142755a...\"}",
    "enabled": true
  }
}
```

**Errors:**
```json
{ "error": true, "message": "type_script is required" }
{ "error": true, "message": "SUDT token not found in registry" }
{ "error": true, "message": "Token already accepted by this business" }
```

---

## 8. Remove a SUDT Token

```
DELETE /api/business/fiber/accept-sudt/:typeScript
Authorization: Bearer <token>
```

**Path parameter:** URL-encode the type script string, or use the symbol:

```
DELETE /api/business/fiber/accept-sudt/RUSD
```

**Response 200:**
```json
{
  "message": "SUDT token disabled for business",
  "data": null
}
```

---

## 9. List Business Accepted Tokens

```
GET /api/business/fiber/accepted-sudt
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "message": "Accepted SUDT tokens",
  "data": [
    {
      "symbol": "RUSD",
      "name": "Reserve USD",
      "type_script": "{\"code_hash\":\"0x1142755a...\"}",
      "logo": "https://raw.githubusercontent.com/stablepp/assets/main/rusd.png",
      "enabled": true,
      "auto_convert": false
    }
  ]
}
```

---

## 10. Business Payment History

```
GET /api/business/fiber/payments?page=1&limit=20
Authorization: Bearer <token>
```

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page |

**Response 200:**
```json
{
  "message": "Payment history",
  "data": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "payments": [
      {
        "id": "fib_xyz123",
        "payment_hash": "0xabcdef1234567890...",
        "amount_ckb": 2000.00,
        "amount_sudt": null,
        "currency": "CKB",
        "description": "Order #12345",
        "received_at": "2026-07-10T12:01:43.000Z",
        "reference_id": "order_abc123"
      }
    ]
  }
}
```

---

## 11. Settlement Statistics (Dashboard)

```
GET /api/business/fiber/stats
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "message": "Settlement statistics",
  "data": {
    "wallet_balance_usdt": 4750.00,
    "total_ckb_received": 50000.00,
    "total_sudt_received": {
      "RUSD": 1500.50,
      "FIBB": 200.00
    },
    "total_payments_settled": 48
  }
}
```

**Fields:**
| Field | Description |
|-------|-------------|
| `wallet_balance_usdt` | Current USDT in business wallet |
| `total_ckb_received` | All-time CKB received (raw CKB units) |
| `total_sudt_received` | All-time per-token totals |
| `total_payments_settled` | Count of completed payments |

---

## 12. Disable Fiber

```
POST /api/business/fiber/disable
Authorization: Bearer <token>
```

**Request body:** empty `{}`

**Response 200:**
```json
{
  "message": "Fiber payments disabled",
  "data": null
}
```

---

## Real-time Updates (SSE)

Listen for live payment events instead of polling:

```javascript
const token = localStorage.getItem('auth_token')
const es = new EventSource(
  `/api/payments/stream?token=${token}`
)

// Fires when a customer's payment lands
es.addEventListener('payment.completed', (e) => {
  const { payment_id, amount_received, currency, timestamp } = JSON.parse(e.data)
  // Show a toast: "Payment received: 95.00 USDT"
  // Refresh stats / history
})

// Fires when wallet balance is updated
es.addEventListener('wallet.balance_updated', (e) => {
  const { total_balance_usd } = JSON.parse(e.data)
  // Update balance display
})

// Cleanup
window.addEventListener('beforeunload', () => es.close())
```

**Event payloads:**

`payment.completed`
```json
{
  "payment_id": "pi_xyz789",
  "amount_received": 95.00,
  "currency": "USDT",
  "original_amount": 2000.00,
  "original_currency": "CKB",
  "timestamp": "2026-07-10T12:01:43.000Z"
}
```

`wallet.balance_updated`
```json
{
  "total_balance_usd": 4750.00,
  "wallets": [
    { "wallet_id": "uw_abc", "balance": 4750.00 }
  ]
}
```

---

## Error Response Format

All errors follow this shape:

```json
{
  "error": true,
  "message": "Human readable error description"
}
```

**HTTP Status codes:**
| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request / validation error |
| `401` | Missing or expired token |
| `403` | Not allowed (wrong account type) |
| `404` | Resource not found |
| `429` | Rate limited — wait and retry |
| `500` | Server error — report to backend team |

---

## Token & RUSD Explained

> **SUDT** is the token standard on CKB (like ERC-20 on Ethereum).  
> **RUSD** is a specific stablecoin that uses the SUDT standard.  
> Each SUDT token is identified by its `type_script` (a JSON object with `code_hash`, `hash_type`, `args`).

**RUSD type script (testnet):**
```json
{
  "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
  "hash_type": "type",
  "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
}
```

Claim testnet RUSD: https://testnet0815.stablepp.xyz/stablecoin  
(Requires JoyID wallet at https://testnet.joyid.dev)

---

## Complete Flow: Business Onboarding

```
1. Business registers / logs in
   POST /api/auth/login → get token

2. Enable Fiber
   POST /api/business/fiber/setup
   → { accept_ckb: true, accept_sudt: true }

3. Add stablecoins
   GET  /api/business/fiber/available-sudt  → pick RUSD
   POST /api/business/fiber/accept-sudt
   → { type_script: "...RUSD type script..." }

4. Done — business can now receive CKB and RUSD payments
```

## Complete Flow: Customer Paying

```
1. Business creates invoice
   POST /api/user/payment-intent/create-wallet
   → { crypto_currency_id: "CKB", reference_id: "order_123" }
   ← response includes wallet.address + wallet.qr_code + expiration_time

2. Frontend shows:
   - QR code (<img src={qr_code}>)
   - Address text + copy button
   - "Send exactly 2000 CKB" instruction
   - Countdown timer to expiration_time

3. Customer scans QR with Fiber wallet and pays
   → Payment settles instantly via Fiber protocol

4. Backend detects payment, converts to USDT, credits business wallet
   → SSE event fires: payment.completed

5. Frontend shows "Payment received!" toast
   → Refresh stats via GET /api/business/fiber/stats
```

---

## Testing Checklist (for frontend engineer)

- [ ] Login and store token
- [ ] Call `POST /api/business/fiber/setup` — confirm 200 response
- [ ] Call `GET /api/business/fiber/available-sudt` — confirm RUSD and FIBB appear
- [ ] Call `POST /api/business/fiber/accept-sudt` with RUSD type_script
- [ ] Call `GET /api/business/fiber/accepted-sudt` — confirm RUSD appears
- [ ] Call `POST /api/user/payment-intent/create-wallet` with `crypto_currency_id: "CKB"` — confirm QR code in response
- [ ] Display QR code using `<img src={data.wallet.qr_code} />`
- [ ] Connect SSE at `/api/payments/stream?token=<token>` — confirm connection opens
- [ ] Call `GET /api/business/fiber/stats` — confirm numbers render
- [ ] Handle 401 by redirecting to login page
- [ ] Handle 400 by showing `error.message` in UI

---

*Backend contact: share this file with your frontend engineer.*  
*Last updated: July 10, 2026*

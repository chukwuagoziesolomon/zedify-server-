# Fiber API - Quick Reference Guide

**Base URL:** `https://api.paymentsystem.com` (dev: `http://localhost:3333`)  
**Authentication:** `Authorization: Bearer <token>`

---

## 🚀 Quick Start Checklist

```
1. ✅ Enable Fiber for Business
   POST /api/business/fiber/setup
   
2. ✅ Add SUDT Tokens (Optional)
   POST /api/business/fiber/accept-sudt
   
3. ✅ Create Payment Intent
   POST /api/payment-intents
   
4. ✅ Display QR Code to Customer
   Use: walletAddress + qrCode from response
   
5. ✅ Listen for Real-time Updates
   EventSource: /api/payments/stream
   
6. ✅ Show Payment Status
   GET /api/business/fiber/payments
```

---

## 📋 Endpoint Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **POST** | `/api/business/fiber/setup` | Enable Fiber |
| **GET** | `/api/business/fiber/setup` | Get config |
| **PATCH** | `/api/business/fiber/settlement` | Update preferences |
| **POST** | `/api/business/fiber/disable` | Disable Fiber |
| **GET** | `/api/business/fiber/available-sudt` | List available tokens |
| **POST** | `/api/business/fiber/accept-sudt` | Add SUDT token |
| **GET** | `/api/business/fiber/accepted-sudt` | List accepted tokens |
| **DELETE** | `/api/business/fiber/accept-sudt/:typeScript` | Remove token |
| **POST** | `/api/payment-intents` | Create invoice |
| **GET** | `/api/business/fiber/payments` | Payment history |
| **GET** | `/api/business/fiber/stats` | Dashboard stats |
| **GET** | `/api/payments/stream` | Real-time updates (SSE) |

---

## 🔑 Key Request/Response Examples

### Enable Fiber
```
POST /api/business/fiber/setup
Authorization: Bearer token

REQUEST:
{
  "fiberChannelId": "ckt1q...",
  "fiberPeerId": "0x...",
  "fiberNodeUrl": "http://127.0.0.1:8227",
  "acceptCkb": true,
  "acceptSudt": true
}

RESPONSE (201):
{
  "success": true,
  "data": {
    "uniqueId": "fbs_abc123xyz",
    "status": "active",
    ...
  }
}
```

### Create CKB Payment
```
POST /api/payment-intents
Authorization: Bearer token

REQUEST:
{
  "businessId": "bus_123",
  "fiatAmount": 100,
  "cryptoNetworkId": "fiber-testnet",
  "cryptoCurrency": "CKB"
}

RESPONSE (201):
{
  "success": true,
  "data": {
    "uniqueId": "pi_abc123",
    "walletAddress": "ckt1q...",
    "qrCode": "data:image/png;base64,...",
    "amountCrypto": 2000.00,
    "currency": "CKB",
    "expiresAt": "2026-07-10T12:30:00Z"
  }
}
```

### Create SUDT Payment
```
POST /api/payment-intents
Authorization: Bearer token

REQUEST:
{
  "businessId": "bus_123",
  "fiatAmount": 100,
  "cryptoNetworkId": "fiber-testnet",
  "cryptoCurrency": "SUDT",
  "sudtTypeScript": {
    "code_hash": "0x1142755a...",
    "hash_type": "type",
    "args": "0x878fcc6f..."
  },
  "sudtSymbol": "RUSD"
}

RESPONSE (201):
{
  "success": true,
  "data": {
    "uniqueId": "pi_abc123",
    "walletAddress": "ckt1q...",
    "qrCode": "data:image/png;base64,...",
    "amountCrypto": 100.00,
    "currency": "RUSD",
    "expiresAt": "2026-07-10T12:30:00Z"
  }
}
```

### Get Payment History
```
GET /api/business/fiber/payments?limit=50&offset=0
Authorization: Bearer token

RESPONSE (200):
{
  "success": true,
  "data": [
    {
      "uniqueId": "fib_abc123xyz",
      "paymentHash": "0x1234567890abcdef...",
      "amountCrypto": 100,
      "currency": "CKB",
      "amountUsd": 5.00,
      "platformFee": 0.25,
      "netAmount": 4.75,
      "status": "completed",
      "paidAt": "2026-07-10T12:02:15Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### Get Stats
```
GET /api/business/fiber/stats?period=30d
Authorization: Bearer token

RESPONSE (200):
{
  "success": true,
  "data": {
    "totals": {
      "totalReceivedCkb": 50000.00,
      "totalReceivedUsdt": 3100.00,
      "totalFeesPaid": 155.00,
      "paymentCount": 50
    },
    "byCurrency": {
      "CKB": { "totalReceived": 50000.00, "paymentCount": 45 },
      "RUSD": { "totalReceived": 2500.50, "paymentCount": 5 }
    },
    "lastSettlementAt": "2026-07-09T23:00:00Z"
  }
}
```

---

## 🔴 Common Errors

| Code | Status | Fix |
|------|--------|-----|
| `AUTH_001` | 401 | Add `Authorization: Bearer token` header |
| `FBS_003` | 404 | Enable Fiber first: `POST /api/business/fiber/setup` |
| `PI_001` | 400 | Same as above |
| `PI_002` | 422 | Use fiatAmount between 0.01-999999.99 |
| `SUDT_001` | 400 | Verify type script format (code_hash, hash_type, args) |
| `FBR_001` | 500 | Check Fiber node URL and connection |
| `RATE_001` | 429 | Wait before retrying |

---

## 📡 Real-time Updates (SSE)

```javascript
// Connect to stream
const eventSource = new EventSource(
  '/api/payments/stream?businessId=bus_123&token=<token>'
)

// Listen for payments
eventSource.addEventListener('payment.completed', (event) => {
  const { payment_id, amount_received, currency, timestamp } = JSON.parse(event.data)
  // Update UI with: "Payment received: 95.00 USDT"
})

// Listen for settlements
eventSource.addEventListener('settlement.completed', (event) => {
  const { settlement_id, total_amount, fees_paid } = JSON.parse(event.data)
  // Update dashboard
})

// Handle errors
eventSource.addEventListener('error', () => {
  eventSource.close()
  // Retry connection
})

// Cleanup
return () => eventSource.close()
```

---

## 💾 Data Types

### TypeScript Interface - Payment Intent Response
```typescript
interface PaymentIntentResponse {
  uniqueId: string
  businessId: string
  status: 'pending' | 'completed' | 'failed' | 'expired'
  fiatAmount: number
  fiatCurrency: string
  cryptoNetwork: string
  cryptoCurrency: string
  amountCrypto: number
  walletAddress: string
  qrCode: string // data:image/png;base64,...
  description: string
  expiresAt: ISO8601DateTime
  createdAt: ISO8601DateTime
  completedAt: ISO8601DateTime | null
}
```

### TypeScript Interface - Payment History
```typescript
interface FiberPayment {
  uniqueId: string
  paymentIntentId: string
  invoiceAddress: string
  paymentHash: string
  amountCrypto: number
  currency: 'CKB' | 'RUSD' | 'USDC'
  amountUsd: number
  platformFee: number
  netAmount: number
  status: 'pending' | 'completed' | 'failed' | 'expired'
  description: string
  createdAt: ISO8601DateTime
  paidAt: ISO8601DateTime | null
  expiresAt: ISO8601DateTime
}
```

---

## 🎯 Frontend Components Needed

```
Dashboard/
├── Settings/
│   ├── FiberSetupForm         ← POST /api/business/fiber/setup
│   ├── FiberTokenManager      ← POST/DELETE /api/business/fiber/accept-sudt
│   └── SettlementPrefs        ← PATCH /api/business/fiber/settlement
├── Payments/
│   ├── CreatePaymentForm      ← POST /api/payment-intents
│   ├── PaymentDisplay         ← Shows QR + address (from response)
│   ├── PaymentMonitor         ← SSE listener /api/payments/stream
│   └── PaymentHistory         ← GET /api/business/fiber/payments
└── Dashboard/
    └── Analytics              ← GET /api/business/fiber/stats
```

---

## 🔗 Integration Checklist

- [ ] Add Bearer token to all requests
- [ ] Display QR code from payment response
- [ ] Copy wallet address to clipboard
- [ ] Show countdown timer (expiresAt)
- [ ] Listen for SSE events in background
- [ ] Show payment status badge (completed/pending/failed)
- [ ] Display USDT amount received (after conversion)
- [ ] Show platform fee breakdown
- [ ] Refresh stats on settlement complete
- [ ] Handle 401 (redirect to login)
- [ ] Handle 500 (show retry button)
- [ ] Handle network errors gracefully

---

## 📞 Support

**Documentation:** `/docs/FIBER_API_DOCUMENTATION.md` (full reference)  
**Issues:** Create GitHub issue or contact API team

---

**Created:** July 10, 2026  
**Status:** Production Ready

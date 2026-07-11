# Fiber Payment API Documentation

**Version:** 1.0.0  
**Last Updated:** July 10, 2026  
**Status:** Production Ready  
**Base URL:** `https://api.paymentsystem.com` or `http://localhost:3333` (dev)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Business Fiber Setup](#business-fiber-setup)
3. [SUDT Token Management](#sudt-token-management)
4. [Payment Intents](#payment-intents)
5. [Payment Monitoring](#payment-monitoring)
6. [Settlement Management](#settlement-management)
7. [Error Codes](#error-codes)
8. [Real-time Updates](#real-time-updates)
9. [Examples](#examples)

---

## Authentication

All endpoints require authentication via Bearer token.

**Header:**
```
Authorization: Bearer <auth_token>
```

**Token Acquisition:**
```
POST /api/auth/login
{
  "email": "business@example.com",
  "password": "password"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "businessId": "bus_123abc",
  "expiresIn": 86400
}
```

---

## Business Fiber Setup

### POST /api/business/fiber/setup
**Enable Fiber payment acceptance for a business**

**Authentication:** Required  
**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "fiberChannelId": "ckt1q...",
  "fiberPeerId": "0x...",
  "fiberNodeUrl": "http://127.0.0.1:8227",
  "acceptCkb": true,
  "acceptSudt": true,
  "autoConvertDaily": false,
  "autoConvertThreshold": 500,
  "settlementSchedule": "daily"
}
```

**Parameters:**
| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `fiberChannelId` | string | Yes | Fiber channel identifier | 255 chars max |
| `fiberPeerId` | string | Yes | Fiber peer public key | 255 chars max |
| `fiberNodeUrl` | string | Yes | Fiber node RPC endpoint | Valid URL |
| `acceptCkb` | boolean | No | Accept CKB payments | Default: true |
| `acceptSudt` | boolean | No | Accept SUDT tokens | Default: true |
| `autoConvertDaily` | boolean | No | Auto-convert daily | Default: false |
| `autoConvertThreshold` | number | No | Min USD before convert | Min: 0, Max: 999999.99 |
| `settlementSchedule` | enum | No | Settlement frequency | "daily", "weekly", "monthly", "manual" |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "uniqueId": "fbs_abc123xyz",
    "businessId": "bus_123",
    "fiberChannelId": "ckt1q...",
    "fiberPeerId": "0x...",
    "fiberNodeUrl": "http://127.0.0.1:8227",
    "acceptCkb": true,
    "acceptSudt": true,
    "autoConvertDaily": false,
    "autoConvertThreshold": 500,
    "settlementSchedule": "daily",
    "status": "active",
    "createdAt": "2026-07-10T12:00:00Z",
    "updatedAt": "2026-07-10T12:00:00Z"
  }
}
```

**Error Responses:**

**400 Bad Request - Invalid Channel ID**
```json
{
  "error": "INVALID_FIBER_CHANNEL",
  "code": "FBS_001",
  "message": "Fiber channel ID format is invalid",
  "details": {
    "field": "fiberChannelId",
    "expected": "String matching CKB address format"
  }
}
```

**401 Unauthorized**
```json
{
  "error": "UNAUTHORIZED",
  "code": "AUTH_001",
  "message": "Authentication token is missing or invalid"
}
```

**404 Not Found - Business**
```json
{
  "error": "BUSINESS_NOT_FOUND",
  "code": "BUS_001",
  "message": "Business account not found",
  "details": {
    "businessId": "bus_123"
  }
}
```

**409 Conflict - Already Enabled**
```json
{
  "error": "FIBER_ALREADY_ENABLED",
  "code": "FBS_002",
  "message": "Fiber is already enabled for this business",
  "details": {
    "existingSettingId": "fbs_existing123"
  }
}
```

**500 Internal Server Error - Fiber Node Unreachable**
```json
{
  "error": "FIBER_NODE_ERROR",
  "code": "FBR_001",
  "message": "Unable to connect to Fiber node",
  "details": {
    "nodeUrl": "http://127.0.0.1:8227",
    "reason": "Connection timeout after 10s"
  }
}
```

---

### GET /api/business/fiber/setup
**Retrieve current Fiber configuration**

**Authentication:** Required

**Query Parameters:** None

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "uniqueId": "fbs_abc123xyz",
    "businessId": "bus_123",
    "fiberChannelId": "ckt1q...",
    "fiberPeerId": "0x...",
    "fiberNodeUrl": "http://127.0.0.1:8227",
    "acceptCkb": true,
    "acceptSudt": true,
    "autoConvertDaily": false,
    "autoConvertThreshold": 500,
    "settlementSchedule": "daily",
    "status": "active",
    "totalReceivedCkb": 0,
    "totalReceivedUsdt": 0,
    "totalFeesPaid": 0,
    "lastSettledAt": null,
    "createdAt": "2026-07-10T12:00:00Z",
    "updatedAt": "2026-07-10T12:00:00Z"
  }
}
```

**Error Response:**

**404 Not Found - No Setup**
```json
{
  "error": "FIBER_NOT_CONFIGURED",
  "code": "FBS_003",
  "message": "Fiber has not been set up for this business yet",
  "solution": "Call POST /api/business/fiber/setup to enable Fiber"
}
```

---

### PATCH /api/business/fiber/settlement
**Update settlement preferences**

**Authentication:** Required

**Request Body:**
```json
{
  "autoConvertDaily": true,
  "autoConvertThreshold": 500,
  "settlementSchedule": "weekly"
}
```

**Parameters (all optional):**
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `autoConvertDaily` | boolean | Enable daily auto-conversion | - |
| `autoConvertThreshold` | number | Minimum USD to trigger conversion | Min: 0, Max: 999999.99 |
| `settlementSchedule` | enum | How often to settle | "daily", "weekly", "monthly", "manual" |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "uniqueId": "fbs_abc123xyz",
    "businessId": "bus_123",
    "autoConvertDaily": true,
    "autoConvertThreshold": 500,
    "settlementSchedule": "weekly",
    "message": "Settlement preferences updated successfully",
    "updatedAt": "2026-07-10T12:05:00Z"
  }
}
```

**Error Responses:**

**422 Unprocessable Entity - Invalid Threshold**
```json
{
  "error": "INVALID_THRESHOLD",
  "code": "FBS_004",
  "message": "Auto-convert threshold must be between 0 and 999999.99",
  "details": {
    "provided": 1000000,
    "min": 0,
    "max": 999999.99
  }
}
```

---

### POST /api/business/fiber/disable
**Disable Fiber payment acceptance**

**Authentication:** Required

**Request Body:** None (or empty object `{}`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Fiber disabled successfully",
    "status": "inactive",
    "updatedAt": "2026-07-10T12:10:00Z",
    "note": "Existing payment channels remain open but no new payments will be accepted"
  }
}
```

---

## SUDT Token Management

### GET /api/business/fiber/available-sudt
**List available SUDT tokens to add**

**Authentication:** Optional (public endpoint)

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | number | Results per page | 50 |
| `offset` | number | Pagination offset | 0 |
| `search` | string | Search by symbol or name | - |
| `network` | enum | Filter by network | "testnet", "mainnet" |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "sudt_rusd_testnet",
      "typeScript": {
        "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
        "hash_type": "type",
        "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
      },
      "symbol": "RUSD",
      "name": "Reserve USD",
      "decimals": 8,
      "logo": "https://example.com/rusd.png",
      "network": "testnet",
      "issuer": "Reserve Labs",
      "enabled": true,
      "isPopular": true
    },
    {
      "uniqueId": "sudt_usdc_testnet",
      "typeScript": {...},
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logo": "https://example.com/usdc.png",
      "network": "testnet",
      "issuer": "Circle",
      "enabled": true,
      "isPopular": true
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### POST /api/business/fiber/accept-sudt
**Enable a SUDT token for business**

**Authentication:** Required

**Request Body:**
```json
{
  "sudtTypeScript": {
    "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
    "hash_type": "type",
    "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
  },
  "symbol": "RUSD",
  "name": "Reserve USD",
  "logo": "https://example.com/rusd.png",
  "autoConvertEnabled": false
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sudtTypeScript` | object | Yes | SUDT type script identifier |
| `symbol` | string | Yes | Token symbol (3-10 chars) |
| `name` | string | Yes | Token display name |
| `logo` | string | No | Logo URL |
| `autoConvertEnabled` | boolean | No | Auto-convert this token | Default: false |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "uniqueId": "bas_abc123xyz",
    "businessId": "bus_123",
    "sudtTypeScript": {
      "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd...",
      "hash_type": "type",
      "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d..."
    },
    "symbol": "RUSD",
    "name": "Reserve USD",
    "logo": "https://example.com/rusd.png",
    "enabled": true,
    "autoConvertEnabled": false,
    "totalReceived": 0,
    "totalConvertedToUsdt": 0,
    "lastReceivedAt": null,
    "createdAt": "2026-07-10T12:00:00Z",
    "updatedAt": "2026-07-10T12:00:00Z"
  }
}
```

**Error Responses:**

**400 Bad Request - Invalid Type Script**
```json
{
  "error": "INVALID_TYPE_SCRIPT",
  "code": "SUDT_001",
  "message": "Type script format is invalid",
  "details": {
    "expected": {
      "code_hash": "64-character hex string",
      "hash_type": "'type' or 'data'",
      "args": "hex string"
    }
  }
}
```

**409 Conflict - Already Accepted**
```json
{
  "error": "SUDT_ALREADY_ACCEPTED",
  "code": "SUDT_002",
  "message": "This SUDT token is already accepted by business",
  "details": {
    "sudtTypeScript": "0x1142755a...",
    "symbol": "RUSD"
  }
}
```

---

### GET /api/business/fiber/accepted-sudt
**List SUDT tokens accepted by business**

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | number | Results per page | 50 |
| `offset` | number | Pagination offset | 0 |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "bas_abc123xyz",
      "businessId": "bus_123",
      "symbol": "RUSD",
      "name": "Reserve USD",
      "sudtTypeScript": {
        "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd...",
        "hash_type": "type",
        "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d..."
      },
      "logo": "https://example.com/rusd.png",
      "enabled": true,
      "autoConvertEnabled": false,
      "totalReceived": 1500.50,
      "totalConvertedToUsdt": 1500.50,
      "lastReceivedAt": "2026-07-09T15:30:00Z",
      "createdAt": "2026-07-08T12:00:00Z",
      "updatedAt": "2026-07-09T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### DELETE /api/business/fiber/accept-sudt/:typeScript
**Stop accepting a SUDT token**

**Authentication:** Required

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `typeScript` | string | URL-encoded type script hash (or full object JSON encoded) |

**Example:**
```
DELETE /api/business/fiber/accept-sudt/0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "SUDT token removed from accepted list",
    "symbol": "RUSD",
    "businessId": "bus_123",
    "note": "Existing payments with this token will still be settled"
  }
}
```

**Error Response:**

**404 Not Found**
```json
{
  "error": "SUDT_NOT_FOUND",
  "code": "SUDT_003",
  "message": "SUDT token not found in business accepted list",
  "details": {
    "typeScript": "0x1142755a..."
  }
}
```

---

## Payment Intents

### POST /api/payment-intents
**Create a new payment intent (invoice)**

**Authentication:** Required (or optional with businessId)

**Request Body:**
```json
{
  "businessId": "bus_123",
  "fiatAmount": 100.00,
  "fiatCurrency": "USD",
  "cryptoNetworkId": "fiber-testnet",
  "cryptoCurrency": "CKB",
  "description": "Order #12345",
  "businessReferenceId": "order_12345",
  "expiryMinutes": 30,
  "notificationUrl": "https://yoursite.com/webhook/payment"
}
```

**Parameters:**
| Field | Type | Required | Description | Notes |
|-------|------|----------|-------------|-------|
| `businessId` | string | Yes | Business account ID | - |
| `fiatAmount` | number | Yes | Amount in fiat currency | Min: 0.01, Max: 999999.99 |
| `fiatCurrency` | enum | Yes | Fiat currency code | "USD", "NGN", "EUR" |
| `cryptoNetworkId` | string | Yes | Crypto network | "fiber-testnet", "ethereum", etc |
| `cryptoCurrency` | enum | Yes (if not SUDT) | Crypto to accept | "CKB", "SUDT" |
| `description` | string | No | Payment description | 255 chars max |
| `businessReferenceId` | string | No | Your reference ID | 255 chars max |
| `expiryMinutes` | number | No | Invoice expiry time | Min: 5, Max: 1440 (default: 30) |
| `notificationUrl` | string | No | Webhook URL for updates | Valid HTTPS URL |

**Special: SUDT Payments**
```json
{
  "businessId": "bus_123",
  "fiatAmount": 100.00,
  "fiatCurrency": "USD",
  "cryptoNetworkId": "fiber-testnet",
  "cryptoCurrency": "SUDT",
  "sudtTypeScript": {
    "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
    "hash_type": "type",
    "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
  },
  "sudtSymbol": "RUSD"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "uniqueId": "pi_abc123xyz",
    "businessId": "bus_123",
    "businessReferenceId": "order_12345",
    "status": "pending",
    "fiatAmount": 100.00,
    "fiatCurrency": "USD",
    "cryptoNetwork": "fiber-testnet",
    "cryptoCurrency": "CKB",
    "amountCrypto": 2000.00,
    "walletAddress": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg6mwu7u4t4xwgf5f6d4p8r9s",
    "description": "Order #12345",
    "expiresAt": "2026-07-10T12:30:00Z",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
    "notificationUrl": "https://yoursite.com/webhook/payment",
    "createdAt": "2026-07-10T12:00:00Z",
    "completedAt": null
  }
}
```

**Error Responses:**

**400 Bad Request - Insufficient Balance**
```json
{
  "error": "BUSINESS_NOT_SETUP",
  "code": "PI_001",
  "message": "Business has not enabled Fiber payment",
  "solution": "Enable Fiber in business settings first"
}
```

**422 Unprocessable Entity - Invalid Amount**
```json
{
  "error": "INVALID_AMOUNT",
  "code": "PI_002",
  "message": "Fiat amount must be between 0.01 and 999999.99",
  "details": {
    "provided": 1000000,
    "min": 0.01,
    "max": 999999.99
  }
}
```

**500 Internal Server Error - Fiber Invoice Creation Failed**
```json
{
  "error": "FIBER_INVOICE_ERROR",
  "code": "FBR_002",
  "message": "Failed to create Fiber invoice",
  "details": {
    "reason": "Fiber node connection timeout",
    "nodeUrl": "http://127.0.0.1:8227"
  }
}
```

---

## Payment Monitoring

### GET /api/business/fiber/payments
**List payments received via Fiber**

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | number | Results per page | 50 |
| `offset` | number | Pagination offset | 0 |
| `status` | enum | Filter by status | - |
| `currency` | string | Filter by currency | - |
| `startDate` | ISO 8601 | Date range start | - |
| `endDate` | ISO 8601 | Date range end | - |

**Status values:** "pending", "completed", "failed", "expired"

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "fib_abc123xyz",
      "paymentIntentId": "pi_123",
      "businessId": "bus_123",
      "invoiceAddress": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg6mwu7u4t4xwgf5f6d4p8r9s",
      "paymentHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "amountCrypto": 2000.00,
      "currency": "CKB",
      "amountUsd": 100.00,
      "platformFee": 5.00,
      "netAmount": 95.00,
      "status": "completed",
      "description": "Order #12345",
      "createdAt": "2026-07-10T12:00:00Z",
      "paidAt": "2026-07-10T12:02:15Z",
      "expiresAt": "2026-07-10T12:30:00Z"
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

---

### GET /api/business/fiber/stats
**Get settlement statistics for business**

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `period` | enum | Time period | "30d" |

**Period values:** "7d", "30d", "90d", "1y", "all"

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "businessId": "bus_123",
    "period": "30d",
    "totals": {
      "totalReceivedCkb": 50000.00,
      "totalReceivedSudt": 2500.50,
      "totalReceivedUsdt": 3100.00,
      "totalFeesPaid": 155.00,
      "averageFee": 3.10,
      "paymentCount": 50,
      "successfulPayments": 48,
      "failedPayments": 2
    },
    "byCurrency": {
      "CKB": {
        "totalReceived": 50000.00,
        "totalReceivedUsdt": 2500.00,
        "paymentCount": 45,
        "averageFee": 2.50
      },
      "RUSD": {
        "totalReceived": 2500.50,
        "totalReceivedUsdt": 2500.50,
        "paymentCount": 5,
        "averageFee": 12.50
      }
    },
    "dailyBreakdown": [
      {
        "date": "2026-07-10",
        "amountReceived": 500.00,
        "paymentCount": 10,
        "feePaid": 25.00
      }
    ],
    "lastSettlementAt": "2026-07-09T23:00:00Z",
    "nextSettlementAt": "2026-07-11T00:00:00Z"
  }
}
```

---

## Settlement Management

### PATCH /api/business/fiber/settlement
**Update settlement preferences** (see earlier section)

---

### POST /api/business/fiber/settle-now
**Trigger immediate settlement** (Manual mode only)

**Authentication:** Required

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "settlementId": "set_abc123xyz",
    "businessId": "bus_123",
    "totalProcessed": 5000.00,
    "totalFees": 250.00,
    "netAmount": 4750.00,
    "currenciesProcessed": ["CKB", "RUSD"],
    "status": "completed",
    "processedAt": "2026-07-10T12:15:00Z",
    "details": {
      "CKB": {
        "amountReceived": 100000,
        "amountUsd": 5000.00,
        "fee": 250.00
      },
      "RUSD": {
        "amountReceived": 0,
        "amountUsd": 0,
        "fee": 0
      }
    }
  }
}
```

**Error Response:**

**409 Conflict - Auto-convert Enabled**
```json
{
  "error": "AUTO_SETTLEMENT_ENABLED",
  "code": "SET_001",
  "message": "Cannot manually settle when auto-settlement is enabled",
  "solution": "Disable autoConvertDaily in settlement settings"
}
```

---

## Real-time Updates

### Server-Sent Events (SSE)

**Endpoint:** `GET /api/payments/stream`

**Authentication:** Bearer token in query or header

**Query Parameters:**
```
GET /api/payments/stream?businessId=bus_123&token=<auth_token>
```

**Connection Setup (JavaScript):**
```javascript
const eventSource = new EventSource(
  '/api/payments/stream?businessId=' + businessId,
  {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  }
)

// Listen for payment completion
eventSource.addEventListener('payment.completed', (event) => {
  const data = JSON.parse(event.data)
  console.log('Payment received:', data)
  // Handle: { payment_id, amount_received, currency, timestamp }
})

// Listen for settlement completion
eventSource.addEventListener('settlement.completed', (event) => {
  const data = JSON.parse(event.data)
  console.log('Settlement completed:', data)
  // Handle: { settlement_id, total_amount, fees_paid }
})

// Listen for errors
eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', event)
  eventSource.close()
})

// Cleanup
return () => eventSource.close()
```

**Event: payment.completed**
```json
{
  "event": "payment.completed",
  "data": {
    "payment_id": "fib_abc123xyz",
    "payment_intent_id": "pi_123",
    "amount_received": 95.00,
    "currency": "USDT",
    "original_amount_crypto": 100,
    "original_currency": "CKB",
    "platform_fee": 5.00,
    "timestamp": "2026-07-10T12:02:15Z"
  }
}
```

**Event: settlement.completed**
```json
{
  "event": "settlement.completed",
  "data": {
    "settlement_id": "set_abc123xyz",
    "total_amount": 4750.00,
    "fees_paid": 250.00,
    "currencies_processed": ["CKB", "RUSD"],
    "timestamp": "2026-07-10T12:15:00Z"
  }
}
```

---

## Error Codes

### Error Code Reference

| Code | HTTP | Description | Resolution |
|------|------|-------------|-----------|
| `AUTH_001` | 401 | Missing or invalid token | Provide valid Bearer token |
| `AUTH_002` | 403 | Insufficient permissions | Use correct business account |
| `BUS_001` | 404 | Business not found | Verify businessId |
| `FBS_001` | 400 | Invalid Fiber channel | Check channel format |
| `FBS_002` | 409 | Fiber already enabled | Disable first before re-enabling |
| `FBS_003` | 404 | Fiber not configured | Enable Fiber first |
| `FBS_004` | 422 | Invalid threshold | Keep between 0-999999.99 |
| `SUDT_001` | 400 | Invalid type script | Check code_hash, hash_type, args |
| `SUDT_002` | 409 | SUDT already accepted | Remove before re-adding |
| `SUDT_003` | 404 | SUDT not found | Use correct typeScript |
| `PI_001` | 400 | Business not setup | Enable Fiber in settings |
| `PI_002` | 422 | Invalid amount | Keep between 0.01-999999.99 |
| `FBR_001` | 500 | Fiber node unreachable | Check node URL and status |
| `FBR_002` | 500 | Fiber invoice failed | Retry or contact support |
| `SET_001` | 409 | Auto-settlement enabled | Disable to manual settle |
| `RATE_001` | 429 | Rate limit exceeded | Wait before retrying |
| `DB_001` | 500 | Database error | Retry after 30 seconds |

### Generic Error Response Format

```json
{
  "error": "ERROR_CODE",
  "code": "ERR_XXX",
  "message": "Human readable error message",
  "details": {},
  "timestamp": "2026-07-10T12:00:00Z",
  "requestId": "req_abc123xyz"
}
```

---

## Examples

### Complete Fiber Payment Flow

**Step 1: Enable Fiber**
```bash
curl -X POST https://api.paymentsystem.com/api/business/fiber/setup \
  -H "Authorization: Bearer token_abc" \
  -H "Content-Type: application/json" \
  -d '{
    "fiberChannelId": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg",
    "fiberPeerId": "0x1234567890abcdef",
    "fiberNodeUrl": "http://127.0.0.1:8227",
    "acceptCkb": true,
    "acceptSudt": true
  }'
```

**Step 2: Add SUDT Token**
```bash
curl -X POST https://api.paymentsystem.com/api/business/fiber/accept-sudt \
  -H "Authorization: Bearer token_abc" \
  -H "Content-Type: application/json" \
  -d '{
    "sudtTypeScript": {
      "code_hash": "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
      "hash_type": "type",
      "args": "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
    },
    "symbol": "RUSD",
    "name": "Reserve USD"
  }'
```

**Step 3: Create CKB Payment Intent**
```bash
curl -X POST https://api.paymentsystem.com/api/payment-intents \
  -H "Authorization: Bearer token_abc" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "bus_123",
    "fiatAmount": 100.00,
    "fiatCurrency": "USD",
    "cryptoNetworkId": "fiber-testnet",
    "cryptoCurrency": "CKB",
    "description": "Order #001"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uniqueId": "pi_abc123",
    "walletAddress": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg6mwu7u4t4xwgf5f6d4p8r9s",
    "qrCode": "data:image/png;base64,...",
    "amountCrypto": 2000.00,
    "currency": "CKB",
    "expiresAt": "2026-07-10T12:30:00Z"
  }
}
```

**Step 4: Customer Pays via Fiber Wallet**
- Scan QR code
- Send 2000 CKB to wallet address
- Payment completes instantly ⚡

**Step 5: Backend Detects Payment**
- PaymentIndexerService polls invoice status
- Payment marked as completed
- Settlement triggered automatically

**Step 6: Frontend Receives SSE Update**
```javascript
eventSource.addEventListener('payment.completed', (event) => {
  const { payment_id, amount_received, currency } = JSON.parse(event.data)
  // payment_id: "fib_abc123"
  // amount_received: 95.00
  // currency: "USDT"
  showToast(`Payment received: ${amount_received} ${currency}`)
})
```

**Step 7: Check Stats**
```bash
curl -X GET https://api.paymentsystem.com/api/business/fiber/stats \
  -H "Authorization: Bearer token_abc"
```

---

## API Response Codes

| Status | Meaning |
|--------|---------|
| `200` | OK - Request successful |
| `201` | Created - Resource created successfully |
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Missing/invalid token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation failed |
| `429` | Too Many Requests - Rate limited |
| `500` | Internal Server Error - Server error |
| `503` | Service Unavailable - Fiber node down |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Setup/Configuration | 1 req/min per business |
| Payment Creation | 10 req/min per business |
| Payment Queries | 30 req/min per business |
| Settlement | 1 req/min per business |

---

## Support

For issues or questions:
- Email: api-support@paymentsystem.com
- Docs: https://docs.paymentsystem.com
- Status: https://status.paymentsystem.com

---

**Last Updated:** July 10, 2026  
**Version:** 1.0.0  
**Environment:** Production Ready

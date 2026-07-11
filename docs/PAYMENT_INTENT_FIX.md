# Payment Intent Currency Lookup - Quick Fix

## Issue Fixed ✅

**Error:** `Invalid crypto currency` when calling `/api/user/payment-intent/create-wallet`

**Root Cause:** 
- Frontend sends `crypto_currency_id` with **currency symbol** (e.g., `"CKB"`, `"USDT"`, `"RUSD"`)
- Code was looking up Currency by `uniqueId` instead of `symbol`

**Solution Applied:**
- Changed Currency lookup from `.where('uniqueId', crypto_currency_id)` to `.where('symbol', crypto_currency_id)`
- Now correctly matches currency symbols sent from frontend

---

## Testing the Fix

### 1. Verify Currencies Exist in Database

```bash
# Connect to your database and run:
SELECT id, uniqueId, symbol, name, cryptoNetworkId FROM currencies LIMIT 10;
```

**Expected output:**
```
id | uniqueId                           | symbol | name            | cryptoNetworkId
1  | 550e8400-e29b-41d4-a716-446655440000 | CKB    | Nervos CKB      | net_ckb_testnet
2  | 550e8400-e29b-41d4-a716-446655440001 | USDT   | USDT (Polygon)  | net_polygon
3  | 550e8400-e29b-41d4-a716-446655440002 | ETH    | Ethereum        | net_ethereum
4  | 550e8400-e29b-41d4-a716-446655440003 | RUSD   | RUSD (SUDT)     | net_ckb_testnet
```

### 2. Test Payment Intent Creation

**Request:**
```bash
curl -X POST http://localhost:3333/api/user/payment-intent/create-wallet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "crypto_currency_id": "CKB",
    "reference_id": "test_order_123"
  }'
```

**Expected Response (Success):**
```json
{
  "error": false,
  "message": "Fiber invoice created successfully",
  "data": {
    "payment_intent_id": "pi_abc123",
    "transaction_id": "txn_xyz789",
    "wallet": {
      "address": "ckt1qzda89...",
      "qr_code": "data:image/png;base64,..."
    },
    "fiat": {
      "amount": 100,
      "currency": "USD"
    },
    "crypto": {
      "amount": 2000,
      "symbol": "CKB"
    }
  }
}
```

**Error Response (Still Failing):**
```json
{
  "error": true,
  "message": "Invalid crypto currency"
}
```

If still failing → See troubleshooting below

### 3. Test with Different Currencies

```bash
# EVM - USDT on Polygon
curl -X POST http://localhost:3333/api/user/payment-intent/create-wallet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "crypto_currency_id": "USDT",
    "reference_id": "test_order_evm"
  }'

# CKB - SUDT (RUSD)
curl -X POST http://localhost:3333/api/user/payment-intent/create-wallet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "crypto_currency_id": "RUSD",
    "reference_id": "test_order_sudt"
  }'
```

---

## Troubleshooting

### Still Getting "Invalid crypto currency"?

**Check 1: Database has Currency Records**

```sql
-- Verify currencies exist
SELECT COUNT(*) FROM currencies WHERE symbol IN ('CKB', 'USDT', 'ETH', 'RUSD');
```

If count is 0 → **Seed data not loaded**
```bash
# Run seeders
node ace db:seed
```

**Check 2: Correct Symbol Casing**

Symbols are case-sensitive:
- ✅ `"CKB"` — correct
- ❌ `"ckb"` — incorrect
- ✅ `"USDT"` — correct  
- ❌ `"usdt"` — incorrect

**Check 3: Application Restarted**

After the fix, make sure you restarted the application:

```bash
# Stop current process (Ctrl+C) then restart
node ace serve --watch
```

**Check 4: Verify Currency Network**

```sql
-- Check if currency has valid cryptoNetworkId
SELECT c.symbol, c.cryptoNetworkId, n.name, n.networkType
FROM currencies c
LEFT JOIN crypto_networks n ON c.cryptoNetworkId = n.uniqueId
WHERE c.symbol IN ('CKB', 'USDT');
```

Expected output:
```
symbol | cryptoNetworkId | name                | networkType
CKB    | net_ckb_...     | CKB (Fiber Testnet) | ckb
USDT   | net_polygon_... | Polygon             | evm
```

---

## API Contract Summary

### POST /api/user/payment-intent/create-wallet

**Request Body:**
```typescript
{
  crypto_currency_id: string  // Currency symbol: "CKB", "USDT", "ETH", "RUSD", etc.
  reference_id: string        // Your order/reference ID
}
```

**Response (200 OK):**
```typescript
{
  error: false
  message: string
  data: {
    payment_intent_id: string
    transaction_id: string
    wallet: {
      address: string
      qr_code: string
    }
    fiat: {
      amount: number
      currency: string
    }
    crypto: {
      amount: number
      symbol: string
    }
  }
}
```

**Error Response (400 Bad Request):**
```typescript
{
  error: true
  message: "Invalid crypto currency" | "Crypto network not found" | "Payment intent not found"
}
```

---

## Code Change Made

**File:** `app/Controllers/Http/PaymentIntentController.ts`

**Before:**
```typescript
const cryptoCurrency = await Currency.query().where('unique_id', crypto_currency_id).first()
```

**After:**
```typescript
const cryptoCurrency = await Currency.query().where('symbol', crypto_currency_id).first()
```

**Why:** Frontend sends currency symbol (e.g., `"CKB"`), not the uniqueId UUID.

---

## Next Steps

1. ✅ Verify currencies are seeded in database
2. ✅ Restart the application  
3. ✅ Test payment intent creation with `crypto_currency_id: "CKB"`
4. ✅ Check transaction is created in database
5. ✅ Verify transaction_id returned in response

If issues persist, check the server logs for detailed error messages.

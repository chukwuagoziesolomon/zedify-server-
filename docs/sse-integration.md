# SSE (Server-Sent Events) Integration Guide

## Overview

The backend pushes real-time updates to the frontend via SSE. Open **one persistent connection** after login; the server will push events whenever something changes.

---

## Connection Endpoints

### User stream
```
GET /api/user/stream
Authorization: Bearer <user_token>
```

### Public payment stream
```
GET /api/payments/stream
Authorization: Bearer <user_token>
```

Both endpoints return `text/event-stream` and stay open until the client disconnects.

---

## Connect from Frontend

### Plain JavaScript
```js
const token = localStorage.getItem('token')
const es = new EventSource('/api/user/stream', {
  headers: { Authorization: `Bearer ${token}` }
})

es.addEventListener('wallet.balance_updated', (e) => {
  const data = JSON.parse(e.data)
  console.log('Balance updated:', data)
})

es.addEventListener('payment.completed', (e) => {
  const data = JSON.parse(e.data)
  console.log('Payment completed:', data)
})

es.onerror = (err) => {
  console.error('SSE error:', err)
  // Auto-reconnect after 3 seconds
  setTimeout(() => location.reload(), 3000)
}
```

### React / Next.js Hook
```js
import { useEffect, useState } from 'react'

export function useSse(userId, token) {
  const [balance, setBalance] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!userId || !token) return

    const es = new EventSource('/api/user/stream', {
      headers: { Authorization: `Bearer ${token}` }
    })

    es.addEventListener('wallet.balance_updated', (e) => {
      const data = JSON.parse(e.data)
      if (data.connected) {
        setConnected(true)
        return
      }
      if (data.total_balance_usd) {
        setBalance(data.total_balance_usd)
      }
    })

    es.addEventListener('payment.completed', (e) => {
      const data = JSON.parse(e.data)
      // Refresh payment history or show toast
      console.log('Payment completed:', data)
    })

    es.onerror = () => {
      setConnected(false)
      // Reconnect after 3s
      setTimeout(() => window.location.reload(), 3000)
    }

    return () => es.close()
  }, [userId, token])

  return { balance, connected }
}
```

### Vue 3 Composition API
```js
import { onMounted, onUnmounted, ref } from 'vue'

export function useSse(token) {
  const balance = ref(null)
  const connected = ref(false)
  let es = null

  onMounted(() => {
    es = new EventSource('/api/user/stream', {
      headers: { Authorization: `Bearer ${token}` }
    })

    es.addEventListener('wallet.balance_updated', (e) => {
      const data = JSON.parse(e.data)
      if (data.connected) {
        connected.value = true
        return
      }
      balance.value = data.total_balance_usd
    })
  })

  onUnmounted(() => {
    if (es) es.close()
  })

  return { balance, connected }
}
```

---

## All Available Events

### 1. `wallet.balance_updated`
**When:** User's wallet balance changes (payment received, withdrawal, transfer)

**Payload:**
```json
{
  "connected": true,
  "total_balance_usd": 1240.50,
  "total_balance_ngn": 1939475.00,
  "wallets": [
    {
      "wallet_id": 1,
      "balance": 1240.50,
      "currency_id": "usdt-bsc-mainnet",
      "network": "BSC"
    }
  ]
}
```

**Frontend action:** Update wallet balance display, refresh balance cards.

---

### 2. `wallet.deposit_credited`
**When:** A deposit is credited to the user's wallet

**Payload:**
```json
{
  "deposit_id": "uuid",
  "amount": 100.50,
  "currency": "USDT",
  "new_balance": 1341.00,
  "credited_at": "2026-07-14T12:00:00.000Z"
}
```

**Frontend action:** Show toast notification, update balance.

---

### 3. `transaction.created`
**When:** A new transaction/payment intent is created

**Payload:**
```json
{
  "transaction_id": "uuid",
  "reference_id": "t_12345",
  "amount": 1000,
  "currency": "NGN",
  "status": "payment_created",
  "created_at": "2026-07-14T12:00:00.000Z"
}
```

**Frontend action:** Add to transaction list, show "awaiting payment" status.

---

### 4. `transaction.confirmed`
**When:** A payment is confirmed on-chain

**Payload:**
```json
{
  "transaction_id": "uuid",
  "reference_id": "t_12345",
  "amount": 1000,
  "currency": "NGN",
  "status": "payment_completed",
  "completed_at": "2026-07-14T12:05:00.000Z",
  "tx_hash": "0xabc123..."
}
```

**Frontend action:** Update transaction status to "completed", show success notification.

---

### 5. `withdrawal.created`
**When:** A withdrawal is initiated

**Payload:**
```json
{
  "transfer_id": "uuid",
  "amount": 500,
  "currency": "USDT",
  "recipient_type": "bank_account",
  "status": "pending",
  "created_at": "2026-07-14T12:00:00.000Z"
}
```

**Frontend action:** Add to withdrawal history, show "processing" status.

---

### 6. `withdrawal.updated`
**When:** A withdrawal status changes (pending → completed/failed)

**Payload:**
```json
{
  "transfer_id": "uuid",
  "status": "completed",
  "tx_hash": "0xdef456...",
  "updated_at": "2026-07-14T12:10:00.000Z"
}
```

**Frontend action:** Update withdrawal status, show notification.

---

### 7. `payment.completed`
**When:** A payment is fully settled (used by payment links and invoices)

**Payload:**
```json
{
  "payment_id": "uuid",
  "amount_received": 0.64,
  "currency": "USDT",
  "timestamp": "2026-07-14T12:05:00.000Z"
}
```

**Frontend action:** Update payment status page, show success message.

---

### 8. `shop.customization_unlocked`
**When:** AI shop customization payment is confirmed

**Payload:**
```json
{
  "shop_id": "uuid",
  "shop_name": "My Shop",
  "unlocked_at": "2026-07-14T12:00:00.000Z"
}
```

**Frontend action:** Enable AI customization features in shop builder.

---

## Event Flow Examples

### Payment Completed Flow
```
1. Customer pays invoice
2. Backend detects payment (webhook/poll)
3. PaymentIndexerService.onPaymentConfirmed() runs
4. Events pushed in order:
   a. transaction.confirmed  → payment intent marked complete
   b. wallet.balance_updated → business wallet credited
   c. payment.completed      → payment link status updated
5. Frontend receives all three events and updates UI
```

### Withdrawal Flow
```
1. User initiates withdrawal
2. Backend creates transfer, deducts wallet
3. Event pushed:
   a. withdrawal.created → shows "processing"
4. Later, when status changes:
   a. withdrawal.updated → shows "completed" or "failed"
```

---

## Error Handling & Reconnection

### Auto-Reconnect Pattern
```js
let es = null
let reconnectTimeout = null

function connect(token) {
  es = new EventSource('/api/user/stream', {
    headers: { Authorization: `Bearer ${token}` }
  })

  es.onopen = () => {
    console.log('SSE connected')
    clearTimeout(reconnectTimeout)
  }

  es.onerror = () => {
    console.log('SSE disconnected, reconnecting in 3s...')
    es.close()
    reconnectTimeout = setTimeout(() => connect(token), 3000)
  }

  // Event listeners...
}

// Cleanup on logout
function disconnect() {
  if (es) es.close()
  clearTimeout(reconnectTimeout)
}
```

### Exponential Backoff (Advanced)
```js
let retryDelay = 1000
const MAX_DELAY = 30000

es.onerror = () => {
  es.close()
  setTimeout(() => {
    connect(token)
    retryDelay = Math.min(retryDelay * 2, MAX_DELAY)
  }, retryDelay)
}

es.onopen = () => {
  retryDelay = 1000 // reset on successful connection
}
```

---

## Testing SSE

### Using curl
```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3335/api/user/stream
```

### Using browser console
```js
const token = localStorage.getItem('token')
const es = new EventSource('/api/user/stream', {
  headers: { Authorization: `Bearer ${token}` }
})

es.onmessage = (e) => console.log('Message:', e.data)
es.addEventListener('wallet.balance_updated', (e) => console.log('Balance:', JSON.parse(e.data)))
```

---

## Backend SSE Emit Reference

| Where it's emitted | Event | When |
|---|---|---|
| `PaymentIndexerService.ts` | `transaction.confirmed` | Payment confirmed on-chain |
| `PaymentIndexerService.ts` | `wallet.balance_updated` | Business wallet credited |
| `PaymentIndexerService.ts` | `payment.completed` | Payment intent completed |
| `WithdrawalController.ts` | `withdrawal.created` | Withdrawal initiated |
| `WithdrawalService.ts` | `withdrawal.updated` | Withdrawal status changed |
| `WithdrawalService.ts` | `wallet.balance_updated` | User wallet debited |
| `PaymentIndexerService.ts` | `shop.customization_unlocked` | AI customization unlocked |
| `UserWalletService.ts` | `wallet.deposit_credited` | Deposit credited to wallet |

---

## Notes

- **One connection per user is enough.** The server supports multiple tabs, but you only need to open one stream.
- **SSE is one-way** (server → client). For client → server, use normal HTTP requests.
- **No message queue required** for small scale. The in-memory `SseService` works for single-server deployments.
- **For production with multiple servers**, replace `SseService` with Redis Pub/Sub or a message queue (BullMQ, RabbitMQ).
- **Token expiry:** If the user's token expires, the SSE connection will close. The frontend should detect this and redirect to login.

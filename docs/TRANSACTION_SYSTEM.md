# Transaction System - Complete Guide

A unified transaction tracking system for both **receiving payments** (customers paying businesses) and **withdrawals** (users withdrawing funds).

---

## Overview

The Transaction system tracks all money movements in your platform:

| Type | Use Case | Status | Example |
|------|----------|--------|---------|
| **receive** | Customer pays QR code | pending → processing → completed | User scans QR, CKB sent to wallet address |
| **withdrawal** | User withdraws funds | pending → processing → completed | User clicks withdraw, funds sent to external address |
| **api-deposit** | API integration deposit | pending → completed | External system deposits via webhook |

---

## Data Model

### Transaction Table
```sql
CREATE TABLE transactions (
  id INT PRIMARY KEY
  unique_id STRING UNIQUE
  
  -- User & Wallet
  user_id INT FK(users.id)
  user_wallet_id STRING FK(user_wallets.unique_id)
  
  -- Transaction type & status
  type ENUM('receive', 'withdrawal')
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled')
  
  -- Amount & currency
  crypto_network_id STRING FK(crypto_networks.unique_id)
  currency_id STRING FK(currencies.unique_id)
  amount_crypto DECIMAL(20, 8)  -- e.g. 2000.00000000 CKB
  amount_usd DECIMAL(20, 8)     -- USD equivalent
  platform_fee_usd DECIMAL(20, 8)
  net_amount_usd DECIMAL(20, 8) -- credited to wallet
  
  -- Addresses
  wallet_address_generated STRING     -- For receive only
  recipient_address STRING           -- For withdrawal only
  sender_address STRING              -- For on-chain receives
  qr_code_data TEXT                  -- base64 QR code
  
  -- Blockchain tracking
  tx_hash STRING                     -- Transaction hash
  payment_hash STRING                -- Fiber payment hash
  invoice_address STRING             -- Fiber invoice
  sudt_type_script TEXT              -- SUDT token details
  block_number INT
  confirmations INT
  
  -- References
  payment_intent_id STRING FK(payment_intents)
  withdrawal_id STRING
  reference_id STRING                -- External order/deposit ID
  description TEXT
  
  -- Timestamps
  initiated_at TIMESTAMP
  processed_at TIMESTAMP
  completed_at TIMESTAMP
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

---

## Receive Transaction Flow

### When Customer Creates Payment Intent

```
User/Business calls: POST /api/user/payment-intent/create-wallet
  ↓
✅ Payment Intent created (order_id, amount)
  ↓
✅ Wallet address generated (CKB or EVM)
  ↓
✅ Transaction record created (type: 'receive', status: 'pending')
  ├─ Stores: wallet address, QR code, amount, expiration
  ├─ Linked to: PaymentIntent
  └─ Status: pending (waiting for payment)
  ↓
Response includes:
  - transaction_id: "txn_abc123"
  - wallet_address: "ckt1q..."
  - qr_code: "data:image/png;base64,..."
  - expiration_time: "2026-07-10T13:30:00.000Z"
```

### When Payment Arrives

```
Customer sends CKB/token to wallet address
  ↓
Backend detects payment (via Fiber, polling, webhook)
  ↓
Update transaction status: pending → processing
  ├─ Set: tx_hash, payment_hash
  └─ Add: block_number, confirmations
  ↓
When confirmed (enough blocks):
  ↓
Update transaction status: processing → completed
  ├─ Credit wallet: +netAmountUsd
  └─ Deduct fee: 5% platform fee
  ↓
Emit SSE: payment.completed
Emit SSE: wallet.balance_updated
Send email: "Payment received"
```

### Example Flow

```json
// 1. Create payment intent
POST /api/user/payment-intent/create-wallet
{
  "crypto_currency_id": "CKB",
  "reference_id": "order_12345"
}

// Response
{
  "payment_intent_id": "pi_xyz",
  "transaction_id": "txn_abc123",
  "wallet": {
    "address": "ckt1qzda89...",
    "qr_code": "data:image/png;base64,..."
  },
  "fiat": { "amount": 100, "currency": "USD" },
  "crypto": { "amount": 2000, "symbol": "CKB" }
}

// 2. Transaction created with pending status
Transaction {
  uniqueId: "txn_abc123",
  type: "receive",
  status: "pending",
  amountCrypto: 2000,
  amountUsd: 100,
  platformFeeUsd: 5,
  netAmountUsd: 95,
  walletAddressGenerated: "ckt1qzda89...",
  paymentIntentId: "pi_xyz",
  initiatedAt: "2026-07-10T12:00:00Z",
  expiresAt: "2026-07-10T13:00:00Z"
}

// 3. Payment detected
- Customer sends 2000 CKB to ckt1qzda89...
- Transaction updated:
  {
    status: "processing",
    txHash: "0xabc123...",
    invoiceAddress: "ckt1qzda89...",
    processedAt: "2026-07-10T12:01:00Z"
  }

// 4. Payment confirmed
- Transaction updated:
  {
    status: "completed",
    blockNumber: 12345,
    confirmations: 12,
    completedAt: "2026-07-10T12:02:00Z"
  }
- Wallet credited: +95 USD
- SSE events fired
- Email sent
```

---

## Withdrawal Transaction Flow

### When User Clicks Withdraw

```
User calls: POST /api/user/withdrawal/initiate
  ├─ Selects network: CKB or EVM
  ├─ Enters amount & recipient address
  └─ OTP sent to email
  ↓
✅ Withdrawal Transaction record created
  ├─ type: 'withdrawal'
  ├─ status: 'pending'
  ├─ Stores: recipient address, amount, network, currency
  └─ Linked to: Withdrawal request
  ↓
Response includes:
  - otp_id: "otp_xyz"
  - transaction_id: "txn_def456"
  - fees breakdown
```

### When User Confirms OTP

```
User calls: POST /api/user/withdrawal/confirm
  ├─ OTP verified
  └─ Withdrawal processing starts
  ↓
✅ Update transaction: pending → processing
  ├─ Deduct from wallet balance
  ├─ Generate tx hash
  ├─ Set: tx_hash, recipient_address
  └─ For CKB: status stays 'processing' (async)
     For EVM: status → 'completed' (on-chain confirmed)
  ↓
SSE events:
  - withdrawal.updated (with tx hash & transaction_id)
  - wallet.balance_updated (new balance)
  ↓
Email: "Withdrawal initiated/completed"
```

### Example Withdrawal Flow

```json
// 1. User initiates withdrawal
POST /api/user/withdrawal/initiate
{
  "type": "crypto",
  "user_wallet_id": "uw_xyz",
  "crypto_currency_id": "CKB",
  "network_id": "net_ckb",
  "amount": 100,
  "recipient_address": "ckt1q..."
}

// Response
{
  "otp_id": "otp_xyz",
  "transaction_id": "txn_def456",
  "fees": {
    "amount": 100,
    "transactionFee": 5,
    "amountToReceive": 95
  }
}

// 2. Withdrawal Transaction created
Transaction {
  uniqueId: "txn_def456",
  type: "withdrawal",
  status: "pending",
  amountCrypto: 95,
  amountUsd: 100,
  platformFeeUsd: 5,
  netAmountUsd: 95,
  recipientAddress: "ckt1q...",
  initiatedAt: "2026-07-10T12:00:00Z"
}

// 3. User confirms OTP
POST /api/user/withdrawal/confirm
{
  "otp_id": "otp_xyz",
  "otp_code": "123456"
}

// Response
{
  "txHash": "0xabc123...",
  "status": "processing",
  "transactionId": "txn_def456"
}

// 4. Transaction updated
{
  status: "processing",
  txHash: "0xabc123...",
  recipientAddress: "ckt1q...",
  processedAt: "2026-07-10T12:01:00Z"
}

// 5. Eventually: status → "completed"
//    (after on-chain confirmation or settlement)
```

---

## TransactionService API

### Create Receive Transaction

```typescript
const transaction = await TransactionService.createReceiveTransaction({
  userId: 123,
  userWalletId: "uw_abc",
  cryptoNetworkId: "net_ckb",
  currencyId: "curr_ckb",
  amountCrypto: 2000,           // 2000 CKB
  amountUsd: 100,               // = $100 USD
  walletAddressGenerated: "ckt1q...",
  qrCodeData: "data:image/png...",
  paymentIntentId: "pi_xyz",
  referenceId: "order_123",
  description: "Payment for order #123",
  expiresAt: DateTime.now().plus({ hours: 1 }),
  invoiceAddress: "ckt1q...",   // For Fiber invoices
  sudtTypeScript: "{...}"       // For SUDT tokens
})

// Returns: Transaction record with status: 'pending'
```

### Create Withdrawal Transaction

```typescript
const transaction = await TransactionService.createWithdrawalTransaction({
  userId: 123,
  userWalletId: "uw_abc",
  cryptoNetworkId: "net_polygon",
  currencyId: "curr_usdt",
  amountCrypto: 95,             // 95 USDT
  amountUsd: 100,               // Original amount before fee
  platformFeeUsd: 5,            // 5% fee
  recipientAddress: "0x742d...",
  description: "Withdrawal to external wallet"
})

// Returns: Transaction record with status: 'pending'
```

### Update Transaction Status

```typescript
await TransactionService.updateTransactionStatus({
  transactionId: "txn_abc",
  status: 'processing',
  txHash: '0xabc123...',
  paymentHash: '0xdef456...',
  blockNumber: 12345,
  confirmations: 5,
  errorMessage: null,
  completedAt: DateTime.now()
})

// Automatically sets processedAt/completedAt based on status
```

### Complete Transaction

```typescript
await TransactionService.completeTransaction('txn_abc')

// For receive transactions: credits wallet with netAmountUsd
// Updates status to 'completed'
// Returns updated Transaction
```

### Get Transaction History

```typescript
const history = await TransactionService.getTransactionHistory(
  userId,
  {
    type: 'receive',    // or 'withdrawal'
    status: 'completed',
    networkId: 'net_ckb',
    page: 1,
    limit: 20
  }
)

// Returns paginated list of transactions
```

---

## API Responses Include Transaction ID

### Payment Intent Creation Response

```json
{
  "error": false,
  "message": "Payment initiated successfully",
  "data": {
    "payment_intent_id": "pi_xyz789",
    "transaction_id": "txn_abc123",
    "reference_id": "order_12345",
    "expiration_time": "2026-07-10T13:00:00.000Z",
    "wallet": {
      "address": "ckt1qzda89...",
      "qr_code": "data:image/png;base64,..."
    },
    "fees": {
      "platform_fee": 5.00,
      "amount_to_receive": 95.00
    }
  }
}
```

### Withdrawal Confirmation Response

```json
{
  "error": false,
  "message": "Withdrawal processed successfully",
  "data": {
    "txHash": "0xabc123...",
    "status": "processing",
    "transaction_id": "txn_def456",
    "amount": 95,
    "currency": "CKB"
  }
}
```

---

## SSE Events with Transaction ID

### payment.completed

```javascript
es.addEventListener('payment.completed', (e) => {
  const data = JSON.parse(e.data)
  // {
  //   payment_id: "pi_xyz",
  //   transaction_id: "txn_abc123",
  //   amount_received: 95.00,
  //   currency: "USDT",
  //   timestamp: "2026-07-10T12:01:43.000Z"
  // }
})
```

### withdrawal.updated

```javascript
es.addEventListener('withdrawal.updated', (e) => {
  const data = JSON.parse(e.data)
  // {
  //   type: 'crypto',
  //   network: 'CKB (Fiber)',
  //   status: 'processing',
  //   amount: 95,
  //   tx_hash: '0xabc123...',
  //   recipient: 'ckt1q...',
  //   currency: 'CKB',
  //   transaction_id: 'txn_def456'
  // }
})
```

---

## Transaction Status Lifecycle

### Receive Transaction
```
pending
  ↓ (Payment detected)
processing
  ├─ setProcessedAt()
  ├─ setTxHash()
  ├─ incrementConfirmations()
  ↓ (Enough confirmations)
completed
  ├─ creditWallet()
  ├─ setCompletedAt()
  └─ emitSSE()

OR

pending → failed
  ├─ setErrorMessage()
  └─ setCompletedAt()
```

### Withdrawal Transaction
```
pending
  ↓ (OTP confirmed)
processing
  ├─ setProcessedAt()
  ├─ setTxHash()
  ├─ deductWallet()
  ↓ (On-chain/settlement confirmed)
completed
  ├─ setCompletedAt()
  └─ emitSSE()

OR

pending/processing → failed
  ├─ setErrorMessage()
  ├─ refundWallet()  // for pending only
  └─ setCompletedAt()
```

---

## Database Queries

### Get all pending receive transactions
```sql
SELECT * FROM transactions
WHERE type = 'receive' AND status = 'pending'
ORDER BY initiated_at ASC
```

### Get user's transaction history (all networks)
```sql
SELECT * FROM transactions
WHERE user_id = ? 
ORDER BY created_at DESC
LIMIT 20
```

### Get specific network transactions
```sql
SELECT * FROM transactions
WHERE user_id = ? 
AND crypto_network_id = 'net_ckb'
AND type = 'receive'
AND status = 'completed'
ORDER BY completed_at DESC
```

### Track wallet by transaction
```sql
SELECT t.*, uw.balance
FROM transactions t
JOIN user_wallets uw ON t.user_wallet_id = uw.unique_id
WHERE t.user_id = ? 
AND t.type = 'receive'
```

---

## Integration Timeline

### Current (Just Implemented)
- ✅ Transaction model with receive/withdrawal types
- ✅ Transaction created when payment intent is created
- ✅ Transaction created when withdrawal is initiated
- ✅ Transaction status updated during payment detection
- ✅ Transaction returned in API responses
- ✅ Transaction ID in SSE events

### Next Phase (Optional Enhancements)
- ⏳ Transaction analytics dashboard
- ⏳ Transaction search/filter UI
- ⏳ Export transactions to CSV
- ⏳ Webhook to alert external systems of transaction status
- ⏳ Recurring transaction batching
- ⏳ Transaction receipts/certificates

---

## Frontend Integration

### Display Transaction on Payment Page
```javascript
// After creating payment intent
const { transaction_id, wallet } = response.data

// Show user:
// 1. QR code: <img src={wallet.qr_code} />
// 2. Wallet address: {wallet.address}
// 3. "Your transaction ID: txn_abc123"
// 4. Listen for SSE updates with this transaction_id
```

### Track Withdrawal Status
```javascript
// After withdrawal initiated
const { transaction_id, txHash } = response.data

// Show user:
// 1. "Withdrawal pending - TX: 0xabc123..."
// 2. "Transaction ID: txn_def456"
// 3. Listen for withdrawal.updated events
// 4. When status: 'completed', show success
```

### Transaction History
```javascript
// GET /api/user/transactions?page=1&limit=20
// Shows all transactions (receive + withdrawal)
// Filterable by network, status, type
```

---

## Example: Complete Payment Flow with Transactions

```
1. Business creates payment request
   POST /api/payment-intent/create-wallet
   → Creates PaymentIntent
   → Creates Transaction (type: receive, status: pending)
   → Returns transaction_id: "txn_abc123"

2. Frontend displays QR + wallet address
   Shows: "Send to address... Transaction ID: txn_abc123"

3. Customer scans QR code
   Sends 2000 CKB to wallet address

4. Backend detects payment
   Updates Transaction:
   {
     status: "processing",
     txHash: "0x...",
     confirmations: 1
   }
   Emits SSE: payment.detected (for live UI)

5. Backend confirms payment (6+ confirmations)
   Updates Transaction:
   {
     status: "completed",
     completedAt: "2026-07-10T12:05:00Z"
   }
   Emits SSE: payment.completed
   Emits SSE: wallet.balance_updated
   Sends email: "Payment received"

6. Frontend shows "Payment complete"
   Fetches updated transaction
   Shows: "Received: 95 USD (after 5% fee)"

7. User can view transaction in history
   GET /api/user/transactions/txn_abc123
   Shows all details: amount, fee, network, status
```

---

## Error Handling

### Transaction Not Found
```json
{
  "error": true,
  "message": "Transaction not found: txn_xyz"
}
```

### Insufficient Balance for Withdrawal
```json
{
  "error": true,
  "message": "Insufficient balance. Available: 50.00 USD"
}
```

### Recipient Address Invalid
```json
{
  "error": true,
  "message": "Invalid recipient address for CKB network"
}
```

### Transaction Expired
```json
{
  "error": true,
  "message": "Transaction expired. Please create a new one."
}
```

---

*Last updated: July 10, 2026*

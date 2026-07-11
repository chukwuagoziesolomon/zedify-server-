# 🚀 CKB Fiber Payment System - Complete Integration Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Current State](#current-state)
3. [Customer Payment Flow](#customer-payment-flow)
4. [Business Setup Flow](#business-setup-flow)
5. [SUDT Token Support](#sudt-token-support)
6. [Implementation Roadmap](#implementation-roadmap)
7. [API Specifications](#api-specifications)
8. [Data Models](#data-models)

---

## System Overview

### Vision
Allow **businesses** to accept payments from **customers** using:
- **CKB** (native cryptocurrency)
- **SUDT** (Simple User-Defined Tokens on CKB)
- **Fiber Payment Channels** (millisecond settlement)

### Why Fiber?
```
Traditional CKB Payment:
  Customer → sends CKB to address → wait 10-15 mins for confirmation

Fiber Channel Payment:
  Customer → sends invoice via Fiber channel → instant settlement
  (Similar to Bitcoin Lightning Network, but for CKB)
```

---

## Current State

### ✅ What Already Exists

#### 1. **FiberService** (`app/Services/FiberService.ts`)
```typescript
✓ getNodeInfo()                    // Connect to Fiber node
✓ openChannel()                    // Create payment channel
✓ listChannels()                   // List existing channels
✓ createInvoice()                  // Generate payment invoice
✓ sendPayment()                    // Send payment via invoice
✓ getPaymentStatus()               // Check payment status
✓ getInvoice()                     // Get invoice details
✓ syncChannels()                   // Sync with Fiber node
```

#### 2. **FiberInvoiceService** (`app/Services/FiberInvoiceService.ts`)
```typescript
✓ createInvoiceForIntent()         // Create Fiber invoice for PaymentIntent
✓ getInvoiceByIntent()             // Lookup by payment intent
✓ markPaid()                       // Mark invoice as paid
✓ markExpired()                    // Mark as expired
✓ checkInvoiceStatus()             // Poll invoice status
✓ syncInvoices()                   // Sync all invoices
```

#### 3. **FiberController** (`app/Controllers/Http/FiberController.ts`)
```
GET    /api/user/fiber/node-info
GET    /api/user/fiber/channels
POST   /api/user/fiber/channels/open
POST   /api/user/fiber/invoices
POST   /api/user/fiber/send
GET    /api/user/fiber/payments/:paymentHash
GET    /api/user/fiber/invoices/:paymentHash
GET    /api/user/fiber/invoices/:address/check
POST   /api/user/fiber/channels/sync
POST   /api/user/fiber/invoices/sync
```

#### 4. **Models**
- `FiberInvoice` - Invoice storage with status tracking
- `FiberChannel` - Payment channel management
- `PaymentIntent` - Already supports `cryptoCurrencyId` (can be CKB!)
- `Currency` - Can represent CKB or SUDT tokens

#### 5. **Payment Detection** (`PaymentIndexerService`)
```typescript
✓ checkCkbPaymentStatus()          // Already checks CKB payments!
✓ checkFiberInvoiceStatus()        // Already polls Fiber invoices!
```

### ❌ What's Missing

```
1. Business Setup
   ├─ API to enable Fiber payments for business
   ├─ API to configure accepted tokens (CKB, SUDT)
   ├─ API to manage Fiber channels
   └─ API to set conversion preferences

2. Integration with PaymentIntent
   ├─ Option to pay with CKB instead of EVM chains
   ├─ Display Fiber invoice in payment UI
   ├─ QR code for Fiber invoice
   └─ Expiration timer

3. Settlement
   ├─ Convert received CKB/SUDT to USDT
   ├─ Auto-withdrawal to business bank account
   └─ Transaction history

4. SUDT Token Support
   ├─ Ability to accept custom SUDT tokens
   ├─ Token registry (which SUD Ts are supported)
   └─ Price conversion for SUDT

5. Business Dashboard
   ├─ View channel balances
   ├─ See received payments
   ├─ Configure auto-settlement
   └─ Withdraw to external wallet
```

---

## Customer Payment Flow

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER PERSPECTIVE                         │
└─────────────────────────────────────────────────────────────────────┘

1. Customer browses online store (e.g., Buy virtual goods for 100 CKB)
   │
   ├─ Click "Pay"
   │
   ├─ See payment options:
   │  ├─ Pay with Bitcoin
   │  ├─ Pay with Ethereum/USDT
   │  ├─ Pay with CKB ← NEW
   │  └─ Pay with USDC (SUDT) ← NEW
   │
2. Customer selects "Pay with CKB"
   │
   ├─ System calculates:
   │  ├─ Order amount: 100 CKB
   │  ├─ Platform fee: 1 CKB
   │  ├─ Total: 101 CKB
   │
3. System generates Fiber invoice
   │
   ├─ FiberService.createInvoice() called
   ├─ Invoice address: (Fiber invoice string)
   ├─ Expires in: 1 hour
   │
4. Customer sees payment screen
   │
   ├─ QR code (encodes invoice string)
   ├─ Invoice address (text, copy button)
   ├─ Amount: 101 CKB
   ├─ Timer: 59:45 remaining
   │
5. Customer opens CKB wallet (e.g., Neuron, Portal)
   │
   ├─ Scans QR code
   │  OR manually pastes invoice address
   │  OR clicks "Open Wallet" → pre-fills amount
   │
6. Wallet shows:
   │
   ├─ Payment to: ckt1.../invoice (Fiber invoice)
   ├─ Amount: 101 CKB
   ├─ Fee: ~0.0001 CKB (negligible)
   │
7. Customer confirms payment in wallet
   │
   ├─ Payment sent via Fiber channel
   │
8. INSTANT SETTLEMENT (< 1 second)
   │
   ├─ Fiber node confirms payment
   ├─ FiberInvoiceService detects payment
   ├─ Updates PaymentIntent status → CONFIRMED → COMPLETED
   ├─ Sends email confirmation to customer
   ├─ Sends email notification to business
   │
9. Payment screen updates
   │
   ├─ "✓ Payment received!"
   ├─ "Redirecting to order confirmation..."
   │
10. Customer receives order
    │
    └─ Business receives CKB notification
```

### API Flow for Customer

```
Step 1: Business gets payment link
GET /api/client/payment-links/[id]
Response: {
  id: "link_123",
  amount: 100,
  currency: "USD"
}

Step 2: Customer initiates payment intent
POST /api/user/payment-intent
Body: {
  fiat_amount: 100,
  fiat_currency: "USD",
  reference_id: "order_456"
}
Response: {
  payment_intent_id: "pi_789",
  fiat_amount: 100,
  assets: [
    {
      symbol: "USDT",
      network: "Ethereum",
      amount: 100
    },
    {
      symbol: "USDT",
      network: "Polygon",
      amount: 100
    },
    {
      symbol: "CKB",              ← NEW
      network: "Fiber",
      amount: 101,
      fee: 1,
      expires_in: 3600
    }
  ]
}

Step 3: Customer selects CKB payment
POST /api/user/payment-intent/create-wallet
Body: {
  payment_intent_id: "pi_789",
  crypto_currency_id: "ckb",
  reference_id: "order_456"
}
Response: {
  payment_intent_id: "pi_789",
  wallet: {
    type: "fiber-invoice",           ← Type differentiator
    address: "invoice_ckb...",       ← Fiber invoice string
    qr_code: "[base64 image]",
    expires_at: "2026-07-09T10:15:00Z"
  },
  crypto: {
    amount: 101,
    symbol: "CKB",
    network: "Fiber Testnet"
  }
}

Step 4: Customer sends payment (wallet external process)
(Payment happens through Fiber channel)

Step 5: System detects payment
POST /api/webhooks/fiber (webhook from Fiber node)
OR
PaymentIndexerService.checkFiberInvoiceStatus() (polling)

Step 6: Customer sees confirmation
GET /api/user/payment-intent/[id]
Response: {
  status: "completed",
  payment_hash: "0x123abc...",
  received_at: "2026-07-09T10:00:15Z",
  crypto: {
    amount: 101,
    symbol: "CKB"
  }
}
```

---

## Business Setup Flow

### Initial Configuration

```
┌────────────────────────────────────────────┐
│      BUSINESS ONBOARDING FOR FIBER         │
└────────────────────────────────────────────┘

Phase 1: Enable Fiber Payments
  │
  ├─ Business logs into dashboard
  ├─ Go to Settings → Payment Methods
  ├─ Toggle: "Accept CKB Payments"
  │
  └─ System calls: BusinessFiberSetupService.enableFiber()
      ├─ Verify Fiber node connection
      ├─ Create receiving channel
      ├─ Store channel ID in database
      └─ Response: "CKB payment enabled!"

Phase 2: Configure Accepted Tokens
  │
  ├─ Business navigates to: Payment Methods → CKB
  ├─ Select accepted tokens:
  │  ├─ ✓ CKB (native)
  │  ├─ ✓ USDC (SUDT type: 0x...)
  │  └─ ✓ FIBB (Fiber native token)
  │
  └─ System calls: BusinessFiberSetupService.configureSudtAcceptance()
      ├─ Store SUDT type scripts in database
      ├─ Update Fiber channel metadata
      └─ Enable invoice generation for those tokens

Phase 3: Set Conversion Preferences
  │
  ├─ Business navigates to: Settings → Settlement
  ├─ Configure:
  │  ├─ Daily auto-conversion to USDT? [Yes/No]
  │  ├─ Min balance to keep in CKB [0.1 - 1.0 CKB]
  │  ├─ Conversion method [Manual / Auto-daily / Auto-weekly]
  │  └─ Withdraw to: Bank account / Merchant wallet
  │
  └─ System saves preferences

Phase 4: Start Accepting Payments
  │
  ├─ Products now have "CKB" as a payment option
  ├─ Customers can pay with:
  │  ├─ Native CKB
  │  ├─ SUDT tokens (USDC, FIBB, etc.)
  │  └─ Via Fiber payment channels
  │
  └─ Business receives payment notifications:
      ├─ Email: "Payment received: 100 CKB"
      ├─ Dashboard: Real-time balance update
      └─ Transaction history: Complete audit trail
```

### Business APIs Needed

```typescript
// Enable Fiber payments for business
POST /api/business/fiber/setup
Body: {
  accept_ckb: true,
  accept_sudt: true,
  node_url?: "custom_fiber_node_url"  // Optional
}
Response: {
  success: true,
  channel_id: "channel_123",
  peer_id: "0x456...",
  ready: true
}

// Get current Fiber setup
GET /api/business/fiber/setup
Response: {
  enabled: true,
  channel_id: "channel_123",
  accepted_tokens: {
    ckb: true,
    sudt: [
      { type_script: "0x...", name: "USDC", logo: "..." },
      { type_script: "0x...", name: "FIBB", logo: "..." }
    ]
  },
  channel_balance_ckb: 50.5,
  received_today_ckb: 12.3
}

// Configure settlement preferences
PATCH /api/business/fiber/settlement
Body: {
  auto_convert_daily: true,
  min_channel_balance: 0.5,
  convert_to: "usdt",
  target_account: "bank"
}
Response: {
  success: true,
  next_conversion: "2026-07-10T00:00:00Z"
}

// View payment history
GET /api/business/fiber/payments
Query: {
  page: 1,
  limit: 20,
  status: "completed|pending|failed"
}
Response: [
  {
    id: "fib_inv_123",
    customer_email: "customer@example.com",
    amount_ckb: 100,
    amount_usd: ~2000,  // Approximate
    token: "CKB",
    status: "completed",
    received_at: "2026-07-09T10:00:15Z",
    payment_hash: "0x..."
  }
]

// Manual withdrawal to wallet
POST /api/business/fiber/withdraw
Body: {
  amount_ckb: 50,
  to_address: "ckb1...",
  purpose: "Settlement"
}
Response: {
  withdrawal_id: "wd_123",
  tx_hash: "0x...",
  status: "processing",
  estimated_arrival: "2026-07-09T10:15:00Z"
}
```

---

## SUDT Token Support

### What are SUDT?

**SUDT = Simple User-Defined Token** (CKB's version of ERC-20)

```
┌──────────────────────────────────────────┐
│           SUDT Token Structure           │
└──────────────────────────────────────────┘

Type Script Hash: 0x48dbf59b4c3f6f319ce122369b0ec4dbbdf87353...
    ↑
    └─ Unique identifier for each token (like ERC-20 contract address)

Token Data:
  ├─ Total Supply: Can be capped or unlimited
  ├─ Name: "Wrapped USDC", "Fiber Token", etc.
  ├─ Symbol: "USDC", "FIBB", "wETH", etc.
  ├─ Decimals: 6 (like USDT on other chains)
  └─ Owner: Can mint/burn tokens

Examples:
  ├─ Testnet "FIBB" (Fiber Token)
  │   Type: 0x48dbf59b4c3f6f319ce122369b0ec4dbbdf87353
  │   Used for: Fiber channel payments
  │
  ├─ Wrapped USDC
  │   Type: 0x5e7a36a430c4d86f57e1e9fd3f62c2157de73...
  │   Used for: Stablecoin payments
  │
  └─ Custom Token (if business creates)
  │   Type: 0x[custom hash]
  │   Used for: Company loyalty points, in-game currency
```

### SUDT Payment Flow

```
Customer has: 100 USDC (SUDT token) in wallet

Step 1: Business shows available payment methods
  ├─ Pay with CKB: 0.5 CKB (~$10 USDT)
  ├─ Pay with USDC: 10 USDC
  └─ Pay with Bitcoin: 0.0005 BTC

Step 2: Customer selects "Pay with USDC"
  │
  ├─ System calls: FiberService.createInvoice()
  │   Body: {
  │     businessId: "biz_123",
  │     amountCkb: 0,              // CKB amount = 0
  │     sudtAmount: 10,            // SUDT amount = 10
  │     sudtTypeScript: "0x5e7a...",  // USDC type script
  │     description: "Order #456"
  │   }
  │
  ├─ Response: Fiber invoice string (works with SUDT)
  │
Step 3: Payment screen shows
  ├─ Amount: 10 USDC
  ├─ Token: USDC (with logo)
  ├─ QR code (encodes invoice + token data)
  │
Step 4: Customer wallet displays
  ├─ Send 10 USDC to invoice
  ├─ Via Fiber channel
  │
Step 5: Payment confirmed
  ├─ Fiber node verifies:
  │  ├─ Correct SUDT type (USDC)
  │  ├─ Correct amount (10)
  │  └─ Payment via Fiber channel
  │
Step 6: Business receives notification
  ├─ "Payment received: 10 USDC (~$10 USD)"
  ├─ Business can hold USDC or convert to USDT
```

### SUDT Management

```typescript
// Admin: Register new SUDT token
POST /api/admin/sudt-registry
Body: {
  type_script: "0x5e7a36...",
  name: "Wrapped USDC",
  symbol: "USDC",
  decimals: 6,
  logo_url: "https://...",
  chainId: "ckb-testnet",
  enabled: true
}

// Business: Enable specific SUDT for payments
POST /api/business/fiber/accept-sudt
Body: {
  type_script: "0x5e7a36...",
  enabled: true
}

// Customer: See accepted tokens when paying
GET /api/user/payment-intent/[id]
Response: {
  assets: [
    {
      symbol: "CKB",
      type: "native-ckb",
      amount: 0.5,
      expires_in: 3600
    },
    {
      symbol: "USDC",
      type: "sudt",
      type_script: "0x5e7a36...",
      amount: 10,
      expires_in: 3600
    }
  ]
}

// Business: See SUDT balances
GET /api/business/fiber/balances
Response: {
  ckb: 50.5,
  sudt: [
    {
      symbol: "USDC",
      type_script: "0x5e7a36...",
      balance: 5000,      // 5000 USDC
      usd_equivalent: "~$5000"
    }
  ]
}
```

---

## Implementation Roadmap

### Phase 1: Business Fiber Setup (1-2 days)
```
NEW FILES:
  ├─ Controllers/Http/BusinessFiberSettingsController.ts
  ├─ Services/BusinessFiberSetupService.ts
  ├─ Models/BusinessFiberSetting.ts
  └─ Validators/BusinessFiberSetupValidator.ts

ROUTES:
  POST   /api/business/fiber/setup              - Enable Fiber
  GET    /api/business/fiber/setup              - Get settings
  PATCH  /api/business/fiber/settlement         - Update settlement
  GET    /api/business/fiber/payments           - Payment history
  POST   /api/business/fiber/withdraw           - Withdraw funds
```

### Phase 2: PaymentIntent Integration (2-3 days)
```
MODIFY:
  ├─ Controllers/Http/PaymentIntentController.ts
  │   └─ Add Fiber invoice option in createWallet()
  │
  ├─ Services/PaymentIntentService.ts
  │   └─ Call FiberInvoiceService.createInvoiceForIntent()
  │
  ├─ Models/PaymentIntent.ts
  │   └─ Add cryptoNetwork relationship
  │
  └─ Models/Currency.ts
      └─ Add SUDT token support

LOGIC:
  When customer selects CKB:
    1. Calculate CKB amount from USDT (via price feed)
    2. Create FiberInvoice
    3. Return invoice + QR code
```

### Phase 3: Payment Detection (1 day)
```
ALREADY EXISTS:
  ✓ PaymentIndexerService.checkFiberInvoiceStatus()

ENHANCE:
  ├─ Add Fiber webhook endpoint
  ├─ Update polling logic for SUDT tokens
  └─ Add settlement trigger on payment confirmed
```

### Phase 4: Settlement Service (2-3 days)
```
NEW:
  ├─ Services/FiberPaymentSettlementService.ts
  │   ├─ settleFiberPayment()          - Receive & record payment
  │   ├─ convertToUsdt()               - Auto-convert CKB/SUDT
  │   └─ withdrawToBank()              - Send to bank account
  │
  └─ Commands/SettleFiberPayments.ts   - Scheduled task

PROCESS:
  1. Payment confirmed via FiberInvoice
  2. Calculate USDT equivalent
  3. If auto-convert enabled:
     a. Get live CKB/USD price
     b. Calculate USDT amount
     c. Trigger TransferService.initiateTransfer()
     d. Schedule bank withdrawal
  4. Send confirmation email
```

### Phase 5: SUDT Support (2-3 days)
```
NEW:
  ├─ Models/SudtRegistry.ts           - Global SUDT token registry
  ├─ Models/BusinessAcceptedSudt.ts   - Per-business token list
  ├─ Services/SudtService.ts          - SUDT operations
  │   ├─ registerToken()
  │   ├─ getPrice()
  │   └─ convertToUsdt()
  │
  └─ Controllers/Http/Admin/SudtRegistryController.ts

UPDATES:
  ├─ Currency model - add SUDT type script
  ├─ FiberService - support SUDT in invoices
  ├─ PaymentIntent - accept SUDT currencies
  └─ Settlement - convert SUDT to USDT
```

### Phase 6: Business Dashboard (Frontend, 3-5 days)
```
NEW PAGES:
  ├─ /business/fiber/setup              - Enable & configure
  ├─ /business/fiber/payments           - Payment history
  ├─ /business/fiber/balances           - CKB & SUDT balances
  ├─ /business/fiber/channels           - Channel management
  └─ /business/fiber/withdraw           - Withdrawal form

FEATURES:
  ├─ Enable/disable Fiber payments
  ├─ Select accepted tokens (CKB, USDC, FIBB, etc.)
  ├─ View real-time balances
  ├─ See payment history
  ├─ Configure auto-settlement
  ├─ Manual withdrawal to wallet
  └─ Transaction receipts
```

### Phase 7: SUDT Conversion (1-2 days)
```
WHEN CUSTOMERS PAY WITH SUDT:
  1. Business receives 10 USDC (SUDT)
  2. System automatically converts to USDT:
     a. Get USDC/USD price (from Chainlink or Oracle)
     b. Calculate USD equivalent: 10 * $1 = $10 USD
     c. Convert to platform USDT amount
  3. Add to business wallet balance
  4. Can be withdrawn to bank account
```

---

## API Specifications

### Detailed Endpoints

#### 1. Business Setup APIs

```typescript
// ────────────────────────────────────────────
// Enable Fiber for a business
// ────────────────────────────────────────────
POST /api/business/fiber/setup
Authorization: Bearer [user_token]

Request Body:
{
  "accept_ckb": true,          // Accept CKB payments
  "accept_sudt": true,         // Accept SUDT tokens
  "min_channel_balance": 0.5,  // Min CKB to keep in channel
  "node_url": null             // Use default or custom node
}

Response (200):
{
  "success": true,
  "fiber_setting": {
    "id": "fs_123",
    "business_id": "biz_789",
    "channel_id": "ch_456",
    "peer_id": "0x123abc...",
    "accept_ckb": true,
    "accept_sudt": true,
    "min_channel_balance": 0.5,
    "created_at": "2026-07-09T10:00:00Z",
    "status": "active"
  },
  "message": "Fiber payments enabled! Ready to accept CKB payments."
}

Errors:
- 400: Business already has Fiber setup
- 400: Fiber node unreachable
- 403: Insufficient permissions


// ────────────────────────────────────────────
// Get Fiber setup for a business
// ────────────────────────────────────────────
GET /api/business/fiber/setup
Authorization: Bearer [user_token]

Response (200):
{
  "success": true,
  "fiber_setting": {
    "id": "fs_123",
    "enabled": true,
    "accept_ckb": true,
    "accept_sudt": true,
    "channel_id": "ch_456",
    "channel_balance_ckb": 50.5,
    "pending_payments_ckb": 12.3,
    "total_received_today_ckb": 100.0,
    "total_received_this_month_ckb": 2500.0,
    "accepted_tokens": [
      {
        "type": "native",
        "symbol": "CKB",
        "enabled": true
      },
      {
        "type": "sudt",
        "symbol": "USDC",
        "type_script": "0x5e7a36...",
        "enabled": true,
        "balance": 5000
      }
    ]
  }
}

Response (404):
{
  "error": "Fiber not enabled for this business"
}


// ────────────────────────────────────────────
// Update settlement preferences
// ────────────────────────────────────────────
PATCH /api/business/fiber/settlement
Authorization: Bearer [user_token]

Request Body:
{
  "auto_convert_daily": true,
  "auto_convert_threshold_ckb": 10.0,  // Auto-convert if > 10 CKB
  "min_channel_balance": 0.5,
  "convert_to": "usdt",
  "settlement_schedule": "daily",      // daily, weekly, manual
  "withdraw_to_account": "bank",       // bank, wallet, hold
  "destination_bank_account_id": "ba_123"
}

Response (200):
{
  "success": true,
  "message": "Settlement preferences updated",
  "next_scheduled_conversion": "2026-07-10T00:00:00Z"
}


// ────────────────────────────────────────────
// Get payment history
// ────────────────────────────────────────────
GET /api/business/fiber/payments
Authorization: Bearer [user_token]
Query: page=1&limit=20&status=completed&sort=date_desc

Response (200):
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "pages": 8
  },
  "payments": [
    {
      "id": "fib_inv_123",
      "payment_hash": "0x456def...",
      "invoice_address": "ckt1...",
      "customer": {
        "email": "customer@example.com",
        "order_id": "order_789"  // From reference_id
      },
      "amount": {
        "ckb": 100,
        "symbol": "CKB",
        "type": "native"
      },
      "usd_equivalent": "~$2000",    // Approximate at time of payment
      "status": "completed",
      "received_at": "2026-07-09T10:00:15Z",
      "confirmed_at": "2026-07-09T10:00:30Z",
      "settled_at": "2026-07-09T14:00:00Z"
    }
  ]
}


// ────────────────────────────────────────────
// Withdraw CKB to external wallet
// ────────────────────────────────────────────
POST /api/business/fiber/withdraw
Authorization: Bearer [user_token]

Request Body:
{
  "amount_ckb": 50.0,
  "to_address": "ckb1qyqvsv5240pxuklf2d3agah5hc6dcydwq3w76cd",
  "purpose": "Settlement",
  "description": "Weekly payout"
}

Response (200):
{
  "success": true,
  "withdrawal": {
    "id": "wd_123",
    "amount_ckb": 50.0,
    "to_address": "ckb1qyqvsv5240pxuklf2d3agah5hc6dcydwq3w76cd",
    "transaction_hash": "0x789ghi...",
    "status": "processing",
    "created_at": "2026-07-09T10:30:00Z",
    "estimated_arrival": "2026-07-09T10:35:00Z"
  }
}

Errors:
- 400: Insufficient balance
- 400: Invalid CKB address
```

#### 2. Customer Payment APIs

```typescript
// ────────────────────────────────────────────
// Create wallet/invoice for payment
// ────────────────────────────────────────────
POST /api/user/payment-intent/create-wallet
Authorization: Bearer [customer_token]

Request Body:
{
  "payment_intent_id": "pi_789",
  "crypto_currency_id": "ckb",    // Select CKB
  "reference_id": "order_456"
}

Response (200):
{
  "success": true,
  "payment_intent": {
    "id": "pi_789",
    "reference_id": "order_456",
    "fiat_amount": 100,
    "fiat_currency": "USD"
  },
  "wallet": {
    "address": "ckt1qyqvsv5240pxuklf2d3agah5hc6dcydwq3w76cd",
    "type": "fiber-invoice",       // Differentiator: fiber-invoice vs address
    "qr_code": "data:image/png;base64,...",
    "expires_at": "2026-07-09T11:00:00Z",
    "expires_in_seconds": 3600
  },
  "crypto": {
    "amount": 0.05,                // 100 USD ≈ 0.05 CKB (example rate)
    "symbol": "CKB",
    "network": "Fiber Testnet",
    "platform_fee": 0.005,         // 10% of crypto amount
    "you_send": 0.055,             // Total amount to send
    "you_get": 100                 // Reference: fiat amount
  },
  "message": "Send 0.055 CKB to pay for your order"
}

Response (400):
{
  "error": true,
  "message": "Business does not accept CKB payments"
}


// ────────────────────────────────────────────
// Check payment status
// ────────────────────────────────────────────
GET /api/user/payment-intent/[payment_intent_id]
Authorization: Bearer [customer_token]

Response (200 - Pending):
{
  "id": "pi_789",
  "status": "pending",
  "wallet_address": "ckt1...",
  "expires_at": "2026-07-09T11:00:00Z"
}

Response (200 - Confirmed):
{
  "id": "pi_789",
  "status": "confirmed",
  "received_at": "2026-07-09T10:30:15Z",
  "payment_hash": "0x123abc...",
  "amount_received": 0.055,
  "amount_expected": 0.055,
  "message": "Payment confirmed! Processing your order..."
}

Response (200 - Completed):
{
  "id": "pi_789",
  "status": "completed",
  "received_at": "2026-07-09T10:30:15Z",
  "completed_at": "2026-07-09T10:35:00Z",
  "payment_hash": "0x123abc...",
  "message": "Payment completed! Your order is processing."
}

Response (200 - Expired):
{
  "id": "pi_789",
  "status": "expired",
  "message": "Invoice expired. Please create a new payment."
}
```

#### 3. Payment Detection Webhooks

```typescript
// ────────────────────────────────────────────
// Fiber payment webhook (if business runs Fiber node)
// ────────────────────────────────────────────
POST /api/webhooks/fiber
Content-Type: application/json

Webhook Body (when payment received):
{
  "event": "payment_received",
  "invoice_address": "ckt1qyqvsv5240pxuklf2d3agah5hc6dcydwq3w76cd",
  "payment_hash": "0x789def...",
  "amount": 0.055,              // In CKB
  "timestamp": 1625808015
}

Our Processing:
1. Lookup invoice by address
2. Find associated PaymentIntent
3. Verify amount matches
4. Update FiberInvoice → status: "paid"
5. Update PaymentIntent → status: "completed"
6. Send confirmation emails
7. Trigger settlement
```

---

## Data Models

### New Models to Create

```typescript
// ════════════════════════════════════════════
// Business Fiber Settings
// ════════════════════════════════════════════
export default class BusinessFiberSetting extends BaseModel {
  @column()
  public businessId: string           // FK → User.uniqueId

  @column()
  public fiberChannelId: string       // Fiber channel for receiving

  @column()
  public fiberPeerId: string          // Fiber node peer ID

  @column()
  public acceptCkb: boolean = true

  @column()
  public acceptSudt: boolean = true

  @column()
  public minChannelBalance: number = 0.5  // Min CKB to keep in channel

  @column()
  public autoConvertDaily: boolean = false

  @column()
  public autoConvertThreshold: number = 10  // Auto-convert if > 10 CKB

  @column()
  public convertToAsset: string = 'usdt'   // Convert CKB to USDT

  @column()
  public settlementSchedule: string = 'manual'  // daily, weekly, manual

  @column()
  public lastConvertedAt?: DateTime

  @column()
  public totalReceivedCkb: number = 0

  @column()
  public totalConvertedUsd: number = 0

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}


// ════════════════════════════════════════════
// Business Accepted SUDT Tokens
// ════════════════════════════════════════════
export default class BusinessAcceptedSudt extends BaseModel {
  @column()
  public businessId: string

  @column()
  public sudtTypeScript: string       // e.g., "0x5e7a36..."

  @column()
  public symbol: string               // e.g., "USDC"

  @column()
  public name: string                 // e.g., "Wrapped USDC"

  @column()
  public logo: string                 // URL to token logo

  @column()
  public enabled: boolean = true

  @column()
  public minBalance: number = 0       // Min to keep in channel

  @column()
  public autoConvertEnabled: boolean = true

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}


// ════════════════════════════════════════════
// Global SUDT Registry
// ════════════════════════════════════════════
export default class SudtRegistry extends BaseModel {
  @column()
  public typeScript: string           // Unique identifier: "0x5e7a36..."

  @column()
  public symbol: string               // "USDC", "FIBB", "wETH"

  @column()
  public name: string                 // "Wrapped USDC"

  @column()
  public decimals: number = 6

  @column()
  public logo: string

  @column()
  public network: string              // "ckb-testnet", "ckb-mainnet"

  @column()
  public issuer?: string              // Who issued this token

  @column()
  public website?: string

  @column()
  public enabled: boolean = true

  @column()
  public totalSupply: string          // In token units

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
```

### Existing Models to Update

```typescript
// ════════════════════════════════════════════
// Update: Currency Model
// ════════════════════════════════════════════
// Add SUDT support

@column()
public typeScript?: string            // For SUDT tokens: "0x5e7a36..."

@column()
public isSudt: boolean = false        // Is this a SUDT token?

@column()
public sudtDecimals?: number          // Decimals for SUDT


// ════════════════════════════════════════════
// Update: PaymentIntent Model
// ════════════════════════════════════════════
// Already supports CKB via cryptoCurrencyId!
// Just needs UI/flow integration

@column()
public cryptoCurrencyId: string | null    // Can be "ckb" or SUDT id

@column()
public feeInCrypto: number | null


// ════════════════════════════════════════════
// Update: FiberInvoice Model (Already exists!)
// ════════════════════════════════════════════
// Add SUDT support

@column()
public amountCkb: number              // CKB amount

@column()
public amountSudt?: number            // SUDT amount (if token payment)

@column()
public sudtTypeScript?: string        // SUDT token identifier

@column()
public currency: string               // "CKB" | "USDC" | "FIBB"
```

---

## Summary Table

| Feature | Current | Needed | Priority |
|---------|---------|--------|----------|
| Fiber channels | ✅ | - | - |
| Fiber invoices | ✅ | - | - |
| Payment detection | ✅ | - | - |
| Business Fiber setup | ❌ | POST /api/business/fiber/setup | High |
| Fiber integration with PaymentIntent | ❌ | Update createWallet endpoint | High |
| SUDT token registry | ❌ | SudtRegistry model + endpoints | Medium |
| Settlement (CKB → USDT) | ❌ | FiberPaymentSettlementService | High |
| Business dashboard UI | ❌ | Frontend pages | Medium |
| Auto-withdrawal | ❌ | Scheduled task | Low |
| SUDT conversion pricing | ❌ | Oracle integration | Medium |

---

## Next Steps

1. **Start with Phase 1**: Create `BusinessFiberSettingsController` & `BusinessFiberSetupService`
2. **Test locally**: Setup Fiber testnet node, create test invoices
3. **Integrate with PaymentIntent**: Connect `createWallet` endpoint
4. **Deploy to production**: After testing with real Fiber node

Would you like me to start implementing any of these phases? I'd recommend starting with Phase 1 (Business Setup) since everything else depends on it.

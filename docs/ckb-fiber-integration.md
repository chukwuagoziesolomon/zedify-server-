# WT Payments Server — CKB Fiber Blockchain Integration

## What Is CKB Fiber?

**Fiber** is a decentralized payment channel network built on the **Nervos CKB** blockchain. It enables instant, off-chain micropayments between two parties by locking collateral in on-chain channels and then exchanging value off-chain without on-chain overhead per transaction.

Key properties of Fiber that make it valuable for a payment platform like WT Payments:

- **Instant finality** — payments confirm in milliseconds, not minutes
- **Zero gas per payment** — only channel open/close touches CKB; all intermediate payments are free
- **Bidirectional channels** — either party can send or receive at any time
- **Native CKB + SUDT support** — pay with CKB or any Simple User Defined Token on-chain
- **Provably secure** — channel state is locked by the Nervos cell model; funds cannot be stolen even if one party goes offline

---

## Why WT Payments Server Needed Fiber Integration

WT Payments Server is a unified payment gateway for businesses. Before Fiber, supported crypto rails were:

- **EVM chains** (BSC, Ethereum) — wallet-to-wallet, one address per payment intent
- **Tron** — same wallet model

These chains suffer from:

1. Confirmation latency (12–30 seconds minimum)
2. Per-transaction network fees
3. No native micropayment support

Adding Fiber brings a fundamentally different rail: **instant, fee-free CKB payments at scale**. This matters for:

- Point-of-sale transactions where speed is critical
- High-volume micropayments (e.g., content monetization, API billing)
- Business settlements in CKB or CKB-based stablecoins (SUDT tokens)

---

## What Was Built — Fiber Activity Summary

### 1. Fiber Network Configuration

**File: `env.ts` (lines 75–79)**

Three environment variables configure the Fiber node connection:

```env
FIBER_NODE_URL=http://localhost:8080
FIBER_BISCUIT_TOKEN=<bearer-token>
FIBER_NETWORK=fiber-testnet
```

`fiber-rpc-js` (npm package) is the client library that wraps the Fiber node JSON-RPC interface.

---

### 2. User-Side Fiber Operations (`/api/user/fiber/*`)

**File: `routes/user/fiber.ts`**

Authenticated end-user operations for interacting with the Fiber network:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/user/fiber/node-info` | Get Fiber node status |
| `GET` | `/api/user/fiber/channels` | List user's open channels |
| `POST` | `/api/user/fiber/channels/open` | Open a new payment channel |
| `POST` | `/api/user/fiber/invoices` | Create a payment invoice |
| `POST` | `/api/user/fiber/send` | Send a CKB/SUDT payment |
| `GET` | `/api/user/fiber/payments/:hash` | Get payment status |
| `GET` | `/api/user/fiber/invoices/:hash` | Get invoice details |
| `GET` | `/api/user/fiber/invoices/:address/check` | Check invoice status |
| `POST` | `/api/user/fiber/channels/sync` | Sync channel state |
| `POST` | `/api/user/fiber/invoices/sync` | Sync invoices |

Handler: `app/Controllers/Http/FiberController.ts`

This enables users to open channels, create invoices, and push payments directly through the CKB Fiber network without touching EVM/Tron flows at all.

---

### 3. Business Fiber Payment Settings (`/api/business/fiber/*`)

**File: `routes/business/fiber.ts`**

Businesses configure whether they accept Fiber payments and how settlement works:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/business/fiber/setup` | Enable Fiber pay-in for a business |
| `GET` | `/api/business/fiber/setup` | Read current Fiber configuration |
| `PATCH` | `/api/business/fiber/settlement` | Update auto-convert, schedule, threshold |
| `POST` | `/api/business/fiber/accept-sudt` | Enable a specific SUDT token |
| `DELETE` | `/api/business/fiber/accept-sudt/:script` | Disable a SUDT token |
| `GET` | `/api/business/fiber/accepted-sudt` | List enabled SUDT tokens |
| `GET` | `/api/business/fiber/available-sudt` | List all available SUDT tokens |
| `GET` | `/api/business/fiber/payments` | Payment history |
| `GET` | `/api/business/fiber/stats` | Settlement statistics |
| `POST` | `/api/business/fiber/disable` | Fully disable Fiber payments |

Handler: `app/Controllers/Http/BusinessFiberSettingsController.ts`

Businesses can opt into accepting CKB + any SUDT token. Auto-convert settings let them automatically convert received CKB to USDT on a schedule or threshold.

---

### 4. Fiber Invoice-Based Payment Flow (core settlement)

This is the **most critical integration**. When a customer pays a business and the business has selected a Fiber-backed CKB/SUDT asset, the server creates a Fiber invoice and the payment resolves via the Fiber protocol rather than a direct wallet send.

**4a. Payment Setup — `app/Services/PaymentSetupService.ts` (line 68)**

```ts
if (paymentFlowStrategy === 'fiber_invoice') {
  const fiberInvoice = await FiberInvoiceService.createInvoiceForIntent(paymentIntent)
  walletAddress = fiberInvoice.invoiceAddress
}
```

When the selected crypto network is a Fiber network (`filet-testnet`, `fiber-mainnet`, `fiber-devnet`), the system creates a `FiberInvoice` record and gives the customer the invoice address instead of a raw wallet address.

**4b. Payment Indexer — `app/Services/PaymentIndexerService.ts`**

The payment indexer detects when a Fiber invoice has been paid and triggers settlement:

```ts
private isFiberInvoiceNetwork(network: any): boolean {
  return networkType === 'ckb' 
    && ['fiber-testnet', 'fiber-mainnet', 'fiber-devnet'].includes(chainKey)
}

private async checkFiberInvoiceStatus(paymentIntent: PaymentIntent) {
  const fiberInvoice = await FiberInvoiceService.getInvoiceByIntent(paymentIntent.uniqueId)
  if (!fiberInvoice || fiberInvoice.status !== 'pending') return

  const result = await FiberService.getPaymentStatus(fiberInvoice.invoiceAddress)
  await FiberInvoiceService.markPaid(fiberInvoice.uniqueId, result.paymentHash)
  await this.onFiberPaymentConfirmed(paymentIntent, fiberInvoice, result.paymentHash)
}
```

Unlike EVM/Tron wallets where the indexer checks blockchain balances, Fiber payments are confirmed by querying the invoice object — a much simpler and faster operation.

**4c. Fiber Payment Settlement — `app/Services/FiberPaymentSettlementService.ts`**

When a payment is confirmed, settlement runs inside a database transaction:

```
SettleFiberPayment(fiberInvoiceId)
  │
  ├─ 1. Load FiberInvoice + PaymentIntent + Business + Wallet
  ├─ 2. Determine currency type
  │     ├─ CKB native  → convertCkbToUsd(amountCkb)
  │     └─ SUDT token  → SudtService.convertSudtToUsdt(amountSudt, typeScript)
  ├─ 3. Deduct 5% platform fee
  ├─ 4. Credit business wallet in USDT (net amount)
  ├─ 5. Set PaymentIntent.status = completed
  ├─ 6. Commit transaction
  ├─ 7. Send email notification (async, fire-and-forget)
  ├─ 8. Emit SSE event to business dashboard
  └─ 9. Return settlement result
```

Amount conversion logic:

- **CKB payments**: `ConversionService.convertCkbToUsd(amountCkb)` — converts the received CKB amount to a USD-equivalent USDT value using live oracle data
- **SUDT payments**: `SudtService.convertSudtToUsdt(amountSudt, typeScript)` — converts any Simple User Defined Token to its USD equivalent

All amounts are credited to the business's wallet as **USDT balance** — the unified settlement currency — regardless of the original Fiber asset.

**4d. Auto-Conversion**

Businesses can enable auto-conversion if they hold a large CKB or SUDT balance:

```ts
async handleAutoConversion(businessId: string) {
  // Check if autoConvertDaily is enabled
  // If balance >= autoConvertThreshold, convert to USDT
  // Reset: lastConvertedAt, totalConvertedUsd tracking
}
```

This runs on a schedule (daily/weekly) and automatically converts accumulated CKB to USDT, removing the need for the business to manually initiate conversion.

---

### 5. Stablecoin Routing via Fiber

**File: `app/Services/StablecoinConversionService.ts` (lines 65–105)**

When a customer buys crypto with NGN, the system decides which rail to use:

```ts
const isFiberRail = network?.networkType.toLowerCase() === 'ckb'

if (isFiberRail) {
  // RUSD path — Fiber/CKB rail
  const { convertedAmount, exchangeRate } = await this.convertViaFiber(
    deposit.nairaAmount, currency
  )
}
```

For CKB-rail stablecoins like **RUSD** (Redeemable USD on Nervos), the NGN-to-stablecoin conversion routes through the Fiber network rather than an EVM on-ramp. This is currently a stub that wires to `FiberService` for the actual liquidity call.

---

### 6. Currency Model — Fiber Ecosystem

**File: `shop builder/Currency.ts` (line 37)**

The `Currency` model includes a `peggedBy` field to identify the issuer/stability mechanism:

```
peggedBy: "Tether" | "Circle" | "CKB / Fiber ecosystem"
```

The extension migration `2026_07_11_000001_extend_currencies.ts` adds the `pegged_by` column. This tagging lets the system know which tokens belong to the Fiber ecosystem and need Fiber rail handling.

---

### 7. Business Fiber Settings Model

**File: `database/migrations/1790000000000_business_fiber_settings.ts`**

Stores per-business Fiber configuration including channel IDs, peer IDs, accepted SUDT tokens, auto-convert settings, and node URL.

---

### 8. SUDT Token Management

**File: `app/Services/SudtService.ts`**

Handles conversion and metadata for Simple User Defined Tokens — the token standard on CKB. Business Fiber settings let merchants whitelist specific SUDTs they accept via `/api/business/fiber/accept-sudt`.

---

### 9. Email Notifications for Fiber Payments

**File: `app/Services/EmailNotificationService.ts` (line 271)**

```ts
async sendFiberPaymentReceivedEmail(
  businessId, invoiceId, paymentHash,
  amountCrypto, currency, amountUsd,
  platformFee, netAmount, description, dashboardUrl
)
```

Whenever a Fiber payment settles, an email is sent asynchronously to the business with:
- Amount received (CKB/SUDT)
- USD equivalent and platform fee
- Dashboard link
- Payment hash for blockchain verification

---

### 10. Real-Time SSE Updates

**File: `app/Services/FiberPaymentSettlementService.ts` (line 135)**

```ts
SseService.emit(paymentIntent.businessId, {
  event: 'payment.completed',
  data: { payment_id, amount_received: amountToReceive, currency: 'USDT', timestamp }
})
```

Businesses see Fiber payment confirmations in real-time via the existing SSE stream, with no polling required.

---

### 11. Functional Tests

**File: `tests/functional/business_fiber_payments.spec.ts`**

Complete test coverage across:

| Test Group | What's Covered |
|-----------|----------------|
| Business Fiber Payments | Setup, settings, SUDT accept/reject, payment history, stats |
| Fiber Payment Settlement | CKB→USDT conversion, 5% fee deduction, SUDT metadata |
| Fiber Invoice Management | CKB amount formatting (Shannon), invoice expiry, payment hash format |
| Fiber Auto-Conversion | Threshold trigger, schedule enforcement, disable behavior |
| Fiber Email Notifications | Amount formatting, dashboard URL injection |
| Payment Indexer Fiber CKB | Currency resolution priority (Fiber-backed CKB preferred), payment flow strategy classification, `isFiberInvoiceNetwork` correctness |

---

## How Fiber Helps the CKB Blockchain

| Capability | Before Fiber (wallet model) | With Fiber |
|-----------|---------------------------|------------|
| Confirmation speed | 12–30s on-chain | Instant off-chain |
| Cost per payment tx | ~0.001 CKB on-chain gas | Zero (channel open/close only) |
| Throughput | ~1 tx/block (~8s) | Unlimited within channel |
| Business settlement | Raw crypto amounts tracked manually | Automatic USDT conversion + fee deduction |
| Customer UX | Wait for block confirmations | Pay and leave immediately |
| Platform revenue | Only on-ramp fees | On-ramp fees + 5% settlement fee + auto-conversion spread |

In practical terms, **Fiber makes CKB viable for everyday merchant payments** — the same way Lightning Network made BTC usable for coffee purchases. Without channels, a physical point-of-sale accepting CKB would leave customers waiting 12+ seconds per transaction. With Fiber, the payment is instant and free.

---

## Architecture Flow — End-to-End Fiber Payment

```
Customer                      WT Payments Server                    CKB Fiber Network
   │                                │                                    │
   │  1. Select "Pay with CKB"      │                                    │
   │───────────────────────────────▶│                                    │
   │                                │  2. resolvePaymentFlowStrategy()    │
   │                                │     → strategy = 'fiber_invoice'    │
   │                                │  3. FiberInvoiceService.create()    │
   │                                │     → returns invoice_address       │
   │  4. { wallet_address,          │                                    │
   │       checkout_url }           │                                    │
   │◀───────────────────────────────│                                    │
   │                                │                                    │
   │  5. Send CKB/SUDT to           │                                    │
   │     invoice_address on         │                                    │
   │     Fiber network              │                                    │
   │────────────────────────────────────────────────────────────────────▶│
   │                                │                                    │
   │                                │  6. PaymentIndexer polls            │
   │                                │     FiberService.getPaymentStatus() │
   │                                │  7. Invoice marked PAID             │
   │                                │  8. settleFiberPayment()            │
   │                                │     ├ convert CKB/SUDT → USDT      │
   │                                │     ├ deduct 5% fee                 │
   │                                │     ├ credit business wallet        │
   │                                │     ├ PaymentIntent → completed    │
   │                                │     └ email + SSE notification     │
   │  9. Real-time dashboard        │                                    │
   │     update (SSE)               │                                    │
   │◀───────────────────────────────│                                    │
```

---

## Key Files Reference

| File | Role |
|------|------|
| `routes/user/fiber.ts` | User-facing Fiber API (channels, invoices, sends) |
| `routes/business/fiber.ts` | Business Fiber configuration API |
| `app/Services/FiberPaymentSettlementService.ts` | Settlement logic: convert, credit, notify |
| `app/Services/PaymentIndexerService.ts` | Detects Fiber payment confirmations via invoice polling |
| `app/Services/PaymentSetupService.ts` | Creates Fiber invoice instead of wallet address when applicable |
| `app/Services/SudtService.ts` | SUDT token conversion to USDT |
| `app/Services/StablecoinConversionService.ts` | NGN-to-stablecoin routing (Fiber rail for RUSD) |
| `app/Services/EmailNotificationService.ts` | Sends payment confirmation emails for Fiber settlements |
| `app/Controllers/Http/FiberController.ts` | User Fiber operations controller |
| `app/Controllers/Http/BusinessFiberSettingsController.ts` | Business settings controller |
| `app/Lib/notification/email-templates/fiber_payment_received.html` | Email template for Fiber settlements |
| `env.ts` lines 75–79 | Fiber node config |
| `database/migrations/1790000000000_business_fiber_settings.ts` | Business Fiber settings table |
| `tests/functional/business_fiber_payments.spec.ts` | Full test suite |
| `app/helpers/cryptoCurrencySelection.ts` | Resolves Fiber-backed CKB as preferred asset |

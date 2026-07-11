# Multi-Chain Withdrawal Guide

Users can now withdraw their funds to multiple blockchains. When they select **CKB (Fiber)**, the withdrawal uses the Fiber infrastructure we integrated. Future support will include **BB, SOL, USDC**, etc.

---

## Quick Overview

| Network | Type | Method | Status |
|---------|------|--------|--------|
| **CKB (Fiber)** | CKB Native | Fiber Payment Channels | ✅ Ready |
| **CKB (SUDT)** | Stablecoins (RUSD, FIBB) | Fiber Payment Channels | ✅ Ready |
| **Ethereum (EVM)** | USDT, ETH | EVM Direct Transfer | ✅ Ready |
| **Polygon (EVM)** | USDT, MATIC | EVM Direct Transfer | ✅ Ready |
| **Solana** | SOL, USDC | Solana RPC | 🔜 Coming |
| **Bitcoin (BB)** | BTC | Bitcoin RPC | 🔜 Coming |

---

## Withdrawal Flow: User Perspective

### 1. User Selects Withdrawal Method

**Endpoint:** `GET /api/user/withdrawal/quote`

**Query Parameters:**
```
amount=100&type=crypto
```

**Response (before selecting network):**
```json
{
  "amount": 100,
  "transactionFee": 5.00,
  "estimatedNetworkFee": 0,
  "amountToReceive": 95.00,
  "asset": "USDT",
  "estimatedArrivalMinutes": 1
}
```

### 2. User Chooses Blockchain

The frontend should display available networks:
- **CKB (Fiber)** — Fast, instant settlement
- **Ethereum / Polygon** — Standard EVM networks
- **Solana** (coming soon)
- **Bitcoin** (coming soon)

### 3. User Initiates Withdrawal

**Endpoint:** `POST /api/user/withdrawal/initiate`

---

## CKB (Fiber) Withdrawal Request

When user selects **CKB Native** or **RUSD/FIBB (SUDT)**:

```json
{
  "type": "crypto",
  "user_wallet_id": "uw_abc123",
  "crypto_currency_id": "CKB",
  "network_id": "net_ckb_testnet",
  "amount": 100,
  "recipient_address": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg...",
  "sudt_type_script": null
}
```

**For SUDT (RUSD/FIBB):**

```json
{
  "type": "crypto",
  "user_wallet_id": "uw_abc123",
  "crypto_currency_id": "RUSD",
  "network_id": "net_ckb_testnet",
  "amount": 100,
  "recipient_address": "ckt1qzda89q270w8pz3ak4m8hzcw7wz6pwc8r5k6jg...",
  "sudt_type_script": "{\"code_hash\":\"0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a\",\"hash_type\":\"type\",\"args\":\"0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b\"}"
}
```

**Response:**
```json
{
  "error": false,
  "message": "OTP sent to your email",
  "data": {
    "otp_id": "otp_xyz789",
    "fees": {
      "amount": 100,
      "transactionFee": 5.00,
      "estimatedNetworkFee": 0,
      "amountToReceive": 95.00,
      "asset": "USDT",
      "estimatedArrivalMinutes": 1
    }
  }
}
```

**Backend Behavior:**
- ✅ Checks if **Fiber is enabled** for the business
- ✅ Validates CKB network and currency
- ✅ For SUDT: Validates sudtTypeScript parameter
- ✅ Deducts 5% platform fee
- ✅ Sends OTP email
- ✅ Prepares withdrawal routing (CKB path detected)

---

## EVM Withdrawal Request

When user selects **Ethereum, Polygon, or other EVM networks**:

```json
{
  "type": "crypto",
  "user_wallet_id": "uw_abc123",
  "crypto_currency_id": "USDT",
  "network_id": "net_polygon",
  "amount": 100,
  "recipient_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  "sudt_type_script": null
}
```

**Response:** Same as CKB (OTP sent)

**Backend Behavior:**
- ✅ Validates Polygon network and USDT currency
- ✅ Routes through **EVM withdrawal path** (ethers.js)
- ✅ Sends transaction on-chain to recipient
- ✅ Returns tx hash on completion

---

## Confirming Withdrawal

Both CKB and EVM use the same confirmation endpoint:

**Endpoint:** `POST /api/user/withdrawal/confirm`

```json
{
  "otp_id": "otp_xyz789",
  "otp_code": "123456"
}
```

**Response (CKB):**
```json
{
  "error": false,
  "message": "Withdrawal processed via Fiber. 95.00 CKB sent.",
  "data": {
    "txHash": "0xabc123...",
    "status": "processing",
    "message": "CKB withdrawal initiated. 95.00 CKB will be sent to ckt1q..."
  }
}
```

**Response (EVM):**
```json
{
  "error": false,
  "message": "Withdrawal processed successfully.",
  "data": {
    "txHash": "0xabc123...",
    "status": "completed",
    "message": "Withdrawal processed successfully."
  }
}
```

---

## Real-time SSE Updates

Listen for withdrawal updates:

```javascript
const es = new EventSource(`/api/payments/stream?token=${token}`)

es.addEventListener('withdrawal.updated', (e) => {
  const { type, network, status, amount, tx_hash, recipient, currency } = JSON.parse(e.data)
  
  if (type === 'crypto' && network === 'CKB (Fiber)') {
    console.log(`CKB withdrawal: ${amount} ${currency} sent to ${recipient}`)
    console.log(`Tx: ${tx_hash}`)
  }
})

es.addEventListener('wallet.balance_updated', (e) => {
  const { wallet_id, balance } = JSON.parse(e.data)
  console.log(`New balance: ${balance}`)
})
```

---

## Backend Routing Logic

The withdrawal system now automatically routes based on network type:

### Withdrawal Router

```
User clicks "Withdraw"
    ↓
POST /api/user/withdrawal/initiate
    ↓
ValidatePayload()
    ↓
Check: network.networkType
    ├─ 'ckb' → processFiberCkbWithdrawal()
    │   ├─ Check: currency.symbol
    │   │   ├─ 'CKB' → Send native CKB via CKB RPC
    │   │   └─ 'RUSD'/'FIBB' → Send SUDT via CKB RPC
    │   └─ Status: processing (async settlement)
    │
    └─ 'evm' → processEvmWithdrawal()
        ├─ Check: currency.contractAddress
        │   ├─ exists → Send ERC-20 token
        │   └─ null → Send native asset
        └─ Status: completed (tx confirmed)
```

---

## Database Fields

### CryptoNetwork Model
```typescript
networkType: 'evm' | 'ckb'  // Discriminator for routing
```

### CryptoWithdrawalPayload Interface
```typescript
interface CryptoWithdrawalPayload {
  type: 'crypto'
  userWalletId: string
  cryptoCurrencyId: string
  networkId: string
  amount: number
  recipientAddress: string
  sudtTypeScript?: string     // ← NEW: For CKB SUDT withdrawals
}
```

---

## Error Handling

**Invalid CKB Network:**
```json
{
  "error": true,
  "message": "Fiber not enabled for your account. Please enable Fiber payments first."
}
```

**Missing SUDT Type Script:**
```json
{
  "error": true,
  "message": "SUDT withdrawal requires sudt_type_script parameter for RUSD."
}
```

**Insufficient Balance:**
```json
{
  "error": true,
  "message": "Insufficient balance. Available: 50.00"
}
```

---

## Testing Checklist

### CKB (Fiber) Withdrawal
- [ ] Get available networks: `GET /api/user/network/list`
- [ ] Verify CKB network has `networkType: 'ckb'`
- [ ] Quote fees: `GET /api/user/withdrawal/quote?amount=100&type=crypto`
- [ ] Initiate with CKB: `POST /api/user/withdrawal/initiate`
  - [ ] With native CKB (`crypto_currency_id: "CKB"`, no sudt_type_script)
  - [ ] With RUSD (include `sudt_type_script` from available tokens)
- [ ] Confirm OTP: `POST /api/user/withdrawal/confirm`
- [ ] Check SSE: Listen for `withdrawal.updated` event
- [ ] Verify balance: `GET /api/user/wallet` shows decreased balance

### EVM Withdrawal
- [ ] Initiate with Polygon USDT
- [ ] Confirm OTP
- [ ] Verify on-chain tx via Polygonscan
- [ ] Check wallet balance updated

### Edge Cases
- [ ] Attempt withdrawal without Fiber enabled (CKB) → error
- [ ] Attempt SUDT withdrawal without sudt_type_script → error
- [ ] Attempt with insufficient balance → error
- [ ] Attempt with invalid recipient address → error
- [ ] OTP expiration after 10 minutes → error on confirm

---

## Future: Adding Solana & Bitcoin Support

When adding **Solana** or **Bitcoin (BB)** support:

1. **Create network records** with `networkType: 'solana' | 'bitcoin'`
2. **Create handler methods** in WithdrawalService:
   - `processSolanaWithdrawal()`
   - `processBitcoinWithdrawal()`
3. **Update routing logic** to check for new network types
4. **Implement service classes** (SolanaService, BitcoinService)
5. **Update withdrawal controller** docs to include new networks

**Example future route:**
```
'solana' → processSolanaWithdrawal()
'bitcoin' → processBitcoinWithdrawal()
```

---

## Migration Checklist

- [x] Updated `WithdrawalService` with multi-chain routing
- [x] Added `processFiberCkbWithdrawal()` method
- [x] Renamed `processCryptoWithdrawal()` to `processEvmWithdrawal()`
- [x] Updated `CryptoWithdrawalPayload` interface with `sudtTypeScript`
- [x] Updated `WithdrawalController` to validate SUDT parameter
- [x] Updated endpoint documentation comments
- [x] CKB routing checks `network.networkType === 'ckb'`
- [x] EVM routing checks `network.networkType === 'evm'`
- [x] SSE events include `network` field
- [x] Email templates receive `networkName: 'CKB (Fiber)' | 'Ethereum' | etc.`

---

*Last updated: July 10, 2026*

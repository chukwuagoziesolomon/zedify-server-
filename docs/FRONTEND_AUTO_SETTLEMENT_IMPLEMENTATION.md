# Frontend Implementation Guide — Auto-Settlement & Payout Features

**Date:** 2026-09-16  
**Scope:** Frontend pages, API integration, and notification states for auto-settlement, payout settings, and wallet management.

---

## 1. Pages to Build

### 1.1 Dashboard → Settings → Auto-Settlement

**Route:** `/dashboard/settings/auto-settlement`  
**Purpose:** Let businesses enable/disable automatic payouts, choose crypto wallet or bank transfer, set schedule, and view last payout status.

### 1.2 Dashboard → Settings → Payout Details (Bank)

**Route:** `/dashboard/settings/payout`  
**Purpose:** Manage bank account details used for NGN payouts via Paystack.

### 1.3 Dashboard → Wallets

**Route:** `/dashboard/wallets`  
**Purpose:** View active wallets, balances, and select a destination wallet for auto-settlement.

---

## 2. API Endpoints

### 2.1 Get General Settings

```http
GET /api/user/settings/general
Authorization: Bearer <WT_TOKEN>
```

**Response body fields relevant to auto-settlement:**

```json
{
  "auto_settlement_enabled": false,
  "auto_settlement_time": "18:00",
  "payout_method": "wallet",
  "payout_wallet_id": "wallet-uuid",
  "payout_currency_id": "currency-uuid",
  "payout_bank_account_no": "0123456789",
  "payout_bank_name": "GTBank",
  "payout_account_name": "John Doe",
  "payout_bank_code": "058",
  "last_payout_at": "2026-09-15T18:00:00.000Z",
  "last_payout_status": "completed"
}
```

### 2.2 Update General Settings

```http
POST /api/client/settings/general
Authorization: Bearer <WT_TOKEN>
Content-Type: application/json
```

**Wallet payout payload:**

```json
{
  "auto_settlement_enabled": true,
  "auto_settlement_time": "18:00",
  "payout_method": "wallet",
  "payout_wallet_id": "wallet-uuid",
  "payout_currency_id": "currency-uuid"
}
```

**Bank payout payload:**

```json
{
  "auto_settlement_enabled": true,
  "auto_settlement_time": "18:00",
  "payout_method": "bank",
  "payout_bank_account_no": "0123456789",
  "payout_bank_name": "GTBank",
  "payout_account_name": "John Doe",
  "payout_bank_code": "058"
}
```

**Rules:**

- When `payout_method = "wallet"`: `payout_wallet_id` is required.
- When `payout_method = "bank"`: `payout_bank_account_no`, `payout_bank_name`, and `payout_bank_code` are required.

### 2.3 Get Payout Details

```http
GET /api/client/settings/payout
Authorization: Bearer <WT_TOKEN>
```

**Response:**

```json
{
  "type": "FIAT",
  "network_id": null,
  "wallet_address": null,
  "currency_id": null,
  "bank_account_no": "0123456789",
  "bank_name": "GTBank",
  "account_name": "John Doe",
  "bank_code": "058"
}
```

### 2.4 Update Payout Details

```http
POST /api/client/settings/payout
Authorization: Bearer <WT_TOKEN>
Content-Type: application/json
```

**Bank payout:**

```json
{
  "type": "FIAT",
  "bank_account_no": "0123456789",
  "bank_name": "GTBank",
  "account_name": "John Doe",
  "bank_code": "058"
}
```

**Crypto payout:**

```json
{
  "type": "CRYPTO",
  "network_id": "network-uuid",
  "wallet_address": "0x...",
  "currency_id": "currency-uuid"
}
```

### 2.5 Get Wallets

```http
GET /api/user/wallets
Authorization: Bearer <WT_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "wallet-uuid",
      "walletAddress": "0x...",
      "balance": 1000.50,
      "currency": { "symbol": "USDT", "name": "Tether" },
      "cryptoNetwork": { "name": "BSC", "networkType": "evm" }
    }
  ]
}
```

---

## 3. Auto-Settlement Page Requirements

### 3.1 State

```ts
const [settings, setSettings] = useState({
  auto_settlement_enabled: false,
  auto_settlement_time: '18:00',
  payout_method: 'wallet',
  payout_wallet_id: '',
  payout_currency_id: '',
  payout_bank_account_no: '',
  payout_bank_name: '',
  payout_account_name: '',
  payout_bank_code: '',
  last_payout_at: null,
  last_payout_status: null,
})
const [saving, setSaving] = useState(false)
const [wallets, setWallets] = useState([])
const [loading, setLoading] = useState(true)
```

### 3.2 On Mount

1. Fetch `/api/user/settings/general` and populate `settings`.
2. Fetch `/api/user/wallets` and populate `wallets`.
3. If `payout_method = 'wallet'` and `payout_wallet_id` is set, validate it exists in the wallets list.

### 3.3 Form Fields

| Field | Type | Required When | Validation |
|-------|------|---------------|------------|
| Enable auto-settlement | checkbox | — | — |
| Payout time | `time` input | `auto_settlement_enabled = true` | 24h format, e.g., `18:00` |
| Payout method | select | `auto_settlement_enabled = true` | `wallet` or `bank` |
| Destination wallet | select | `payout_method = 'wallet'` | Must be one of user's active wallets |
| Bank account number | text | `payout_method = 'bank'` | Required |
| Bank name | text | `payout_method = 'bank'` | Required |
| Account name | text | `payout_method = 'bank'` | Optional |
| Bank code | text | `payout_method = 'bank'` | Required |

### 3.4 Submit Behavior

- Call `POST /api/client/settings/general` with the full `settings` object.
- Show success/error toast.
- On success, refresh `last_payout_at` and `last_payout_status` from the response.

### 3.5 Last Payout Status Display

Show when `last_payout_at` is not null:

```tsx
{settings.last_payout_at && (
  <div className="text-sm text-gray-500">
    Last payout: {new Date(settings.last_payout_at).toLocaleString()} — Status: {settings.last_payout_status}
  </div>
)}
```

Possible values for `last_payout_status`:

- `completed` — payout succeeded
- `failed` — payout failed
- `processing` — payout is in progress
- `null` — no payout has been processed yet

---

## 4. Payout Details Page Requirements

### 4.1 State

```ts
const [payout, setPayout] = useState({
  type: 'FIAT',
  network_id: '',
  wallet_address: '',
  currency_id: '',
  bank_account_no: '',
  bank_name: '',
  account_name: '',
  bank_code: '',
})
const [saving, setSaving] = useState(false)
```

### 4.2 Toggle Between Crypto and Fiat

When `type = 'FIAT'`:
- Show bank form fields.
- Optionally fetch banks list from `/api/user/banks` if such an endpoint exists, or let admin enter manually.

When `type = 'CRYPTO'`:
- Show network, wallet address, and currency fields.
- Network and currency can be fetched from existing wallet data or a separate lookup endpoint.

### 4.3 Submit

```ts
const response = await fetch('/api/client/settings/payout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  },
  body: JSON.stringify(payload),
})
```

---

## 5. Wallets Page Requirements

### 5.1 Display

For each active wallet:

| Field | Description |
|-------|-------------|
| Wallet address | Truncated: `0x1234...5678` |
| Network | e.g., BSC, Polygon, CKB |
| Currency | e.g., USDT, USDC |
| Balance | Current USDT balance |
| Status | Active / Inactive |

### 5.2 Select for Auto-Settlement

On the Auto-Settlement page, the wallet dropdown should:

- List all active wallets.
- Show `${cryptoNetwork.name} — ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`.
- Default to the first wallet if `payout_wallet_id` is not set.

---

## 6. Notification Expectations

### 6.1 Email

When auto-settlement is processed, the backend sends an email with subject **"Auto-Settlement Processed"** using the `auto_settlement_completed` template.

Template variables:

```ts
{
  businessName: string,
  amount: string, // USDT amount, e.g., "100.00"
  method: string, // "Bank Transfer (NGN)" or "Crypto Wallet"
  nairaAmount: string | null, // e.g., "150,000"
  completedAt: string, // e.g., "16 Sep 2026, 18:00"
  year: number // e.g., 2026
}
```

### 6.2 WhatsApp

When bank auto-settlement is processed, the backend sends a WhatsApp message to `user.phone` if configured.

Message format:

```
Your auto-settlement of 100.00 USDT has been processed. You received ₦150,000 in ****1234. Status: Successful. Ref: auto_1694832000000
```

**Frontend requirement:** Ensure the user's phone number is stored and formatted correctly in the user profile. The WhatsApp message is sent automatically by the backend; no frontend action is required beyond ensuring the phone number exists.

---

## 7. Error Handling

| Error | Cause | Frontend Action |
|-------|-------|-----------------|
| `payout_wallet_id is required when payout_method is wallet` | Wallet selected but not saved | Show field error |
| `payout_bank_account_no is required when payout_method is bank` | Missing bank account | Show field error |
| `Bank account details not configured` | No `PayoutDetail` record for bank | Prompt user to fill payout details |
| `No active wallets with balance` | All wallets empty or inactive | Disable auto-settlement toggle or show warning |
| `Could not calculate Naira equivalent` | Conversion service unavailable | Show server error, retry later |
| `Paystack API key not configured` | Backend misconfigured | Show generic error, contact support |

---

## 8. Environment Variables the Frontend Should Know About

These are backend-only, but the frontend may need to display status or explain delays:

- `PAYSTACK_SECRET_KEY` — must be set for bank payouts to work.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — must be set for WhatsApp notifications.

If these are missing, the backend will log warnings but will not crash.

---

## 9. Implementation Order

1. **Wallets page** — list wallets, show balances.
2. **Payout Details page** — CRUD for bank/crypto payout info.
3. **Auto-Settlement page** — main settings form, time picker, method toggle, wallet dropdown, last payout status.
4. **Notifications** — ensure email and WhatsApp are working in production.

---

## 10. Testing Checklist

- [ ] Enable auto-settlement with wallet payout → save → verify backend accepts.
- [ ] Enable auto-settlement with bank payout but missing bank fields → expect validation error.
- [ ] Enable auto-settlement with bank payout, fill all fields → save → dry-run `node ace process:payouts --dry-run` shows eligible business.
- [ ] Run actual `node ace process:payouts` in test environment with small balance.
- [ ] Verify email arrives with correct template variables.
- [ ] Verify WhatsApp message arrives if phone number is set.
- [ ] Toggle auto-settlement off → run command → business is skipped.
- [ ] Change `auto_settlement_time` to future time → run command → business is skipped until time passes.
- [ ] Run command twice within interval → second run skips due to `last_payout_at` interval check.

---

## Relevant Backend Files

- `app/Controllers/Http/SettingsGeneralController.ts` — general settings API
- `app/Controllers/Http/PayoutController.ts` — payout details API
- `app/Validators/SettingsGeneralValidator.ts` — validation rules
- `commands/ProcessPayouts.ts` — auto-settlement command
- `app/Services/PayoutService.ts` — Paystack integration
- `app/Services/WhatsAppNotificationService.ts` — WhatsApp messaging
- `app/Lib/notification/email-templates/auto_settlement_completed.html` — email template

# Frontend Business Wallet Implementation

This document describes the frontend work required for business wallet provisioning, dashboard balances, payment reconciliation, and CKB/Fiber payments.

## 1. Authentication

All wallet and dashboard endpoints require the authenticated user's token:

```http
Authorization: Bearer <user_token>
Content-Type: application/json
```

If the token is missing or expired, clear the session and redirect to login.

## 2. Provision the business wallet

A business must provision a wallet before completed payments can be credited to its wallet balance.

### Endpoint

```http
POST /api/user/wallet/provision
```

### Request

```json
{
  "currency_id": "ckb_currency_unique_id"
}
```

Use the `unique_id` of the accepted CKB currency returned by the currencies/assets endpoint. Do not send the currency symbol unless the backend specifically returned it as the currency ID.

### Success response

```json
{
  "error": false,
  "data": "Business wallet provisioned",
  "code": 200,
  "result": {
    "wallet_id": "wallet_123",
    "wallet_address": "ckt1...",
    "network": "Nervos CKB Testnet",
    "network_unique_id": "network_123",
    "currency": "CKB",
    "currency_unique_id": "ckb_currency_unique_id",
    "custody_status": "custodial",
    "status": "active"
  }
}
```

The endpoint is idempotent. Calling it again for the same business and network returns the existing active wallet instead of generating another wallet.

The private key is never returned to the frontend.

### Frontend behavior

1. Show a `Create business wallet` action when no active wallet exists.
2. Submit the selected CKB currency ID.
3. Display the returned wallet address and network.
4. Provide a copy-address action.
5. Do not display or request a private key.
6. Refresh wallet balance and dashboard statistics after provisioning.

## 3. Wallet balance endpoint

### Endpoint

```http
GET /api/user/wallet/balance
```

### Success response

```json
{
  "error": false,
  "data": "Wallet balance retrieved",
  "code": 200,
  "result": {
    "user_id": "business_123",
    "wallets": [
      {
        "wallet_id": "wallet_123",
        "network": "Nervos CKB Testnet",
        "network_unique_id": "network_123",
        "currency": "CKB",
        "currency_unique_id": "ckb_currency_unique_id",
        "wallet_address": "ckt1...",
        "balance": 12.45,
        "total_deposited": 12.45,
        "total_withdrawn": 0,
        "status": "active",
        "created_at": "2026-09-14T12:00:00.000+00:00"
      }
    ],
    "total_balance": 12.45
  }
}
```

`balance` and `total_balance` are internal wallet balance values after conversion and fees. They are not the original fiat amount and should be labeled with the configured wallet currency.

## 4. Dashboard statistics

### Endpoint

```http
GET /api/dashboard/stats
```

### Success response

```json
{
  "error": false,
  "data": "Dashboard stats retrieved successfully",
  "code": 200,
  "result": {
    "totalWalletBalance": 12.45,
    "totalPayout": 0,
    "totalPaymentProcessed": 30399.96,
    "paymentCount": 5
  }
}
```

Frontend mapping:

```ts
const stats = response.result

setDashboardStats({
  walletBalance: Number(stats.totalWalletBalance || 0),
  totalPayout: Number(stats.totalPayout || 0),
  totalPaymentProcessed: Number(stats.totalPaymentProcessed || 0),
  paymentCount: Number(stats.paymentCount || 0),
})
```

Important distinction:

- `totalPaymentProcessed` is the lifetime fiat payment volume.
- `totalWalletBalance` is the current converted wallet balance.
- These values are expected to be different.
- Read values from `response.result`, not `response.data`.

## 5. Analytical transaction chart

### Weekly request

```http
GET /api/dashboard/analytical-transactions?period=week
```

### Monthly request

```http
GET /api/dashboard/analytical-transactions?period=month
```

### Success response

```json
{
  "error": false,
  "data": "Analytical transactions retrieved successfully",
  "code": 200,
  "result": {
    "period": "week",
    "year": 2026,
    "total_count": 2,
    "total_amount": 30399.96,
    "data": [
      {
        "label": "Mon",
        "count": 1,
        "amount": 15000
      },
      {
        "label": "Tues",
        "count": 1,
        "amount": 15399.96
      }
    ]
  }
}
```

Map the chart from `response.result.data`:

```ts
const chartData = response.result.data.map((item: any) => ({
  name: item.label,
  transactions: Number(item.count || 0),
  amount: Number(item.amount || 0),
}))
```

The backend groups confirmed payments by `completed_at`, not by payment-intent creation time. Only records with status `payment_completed` are included.

## 6. Payment confirmation refresh

After receiving a confirmed-payment event, refetch all dashboard data:

```ts
await Promise.all([
  fetch('/api/dashboard/stats', { cache: 'no-store' }),
  fetch('/api/dashboard/analytical-transactions?period=week', { cache: 'no-store' }),
  fetch('/api/user/wallet/balance', { cache: 'no-store' }),
])
```

Refresh after these SSE events:

- `transaction.confirmed`
- `wallet.balance_updated`
- `payment.completed`

Also refetch when:

- The dashboard opens.
- The user changes Week or Month.
- A wallet is provisioned.
- The user manually presses Refresh.

Do not use stale cached dashboard values after a confirmation event.

## 7. CKB/Fiber payment flow

1. Create or load the payment intent.
2. Request the selected CKB/Fiber wallet or invoice.
3. Display the returned address or Fiber invoice.
4. Wait for backend confirmation.
5. Do not show payment success based only on a wallet transaction submission.
6. Wait for `transaction.confirmed` or a confirmed status response.
7. Refresh wallet balance and dashboard statistics.

## 8. Error responses

### Authentication error

```json
{
  "error": true,
  "data": "Unauthorized access. Please sign in again.",
  "code": 401
}
```

Action: clear the token and redirect to login.

### Missing currency ID

```json
{
  "error": true,
  "data": "currency_id is required",
  "code": 400
}
```

Action: require the user to select a supported currency.

### Unsupported currency

```json
{
  "error": true,
  "data": "Business wallet provisioning currently supports CKB currencies only",
  "code": 400
}
```

Action: do not retry automatically. Show that CKB is currently the supported custodial wallet network.

### Network mismatch

```json
{
  "error": true,
  "data": "CKB network mismatch. Backend is configured for testnet",
  "code": 400
}
```

Action: show the configured network and do not allow a mainnet/testnet wallet to be mixed.

### Missing backend encryption configuration

```json
{
  "error": true,
  "data": "APP_KEY must be configured before custodial wallets can be provisioned",
  "code": 400
}
```

Action: show a generic provisioning failure. Do not expose configuration details to end users in production.

### No active wallet

```json
{
  "error": true,
  "data": "No active wallet found for network",
  "code": 400
}
```

Action: show the wallet provisioning action and retry after provisioning completes.

### Server or database error

```json
{
  "error": true,
  "data": "Unexpected error. Please, contact an Administrator.",
  "code": 500
}
```

Action: show a retry state and log the request ID if the backend provides one.

## 9. Formatting rules

- Format wallet balances using the wallet currency.
- Format processed payment totals using the payment's fiat currency.
- Do not label every amount as USD.
- Treat zero values as valid data, not as request failures.
- Display loading, empty, error, and retry states separately.
- Never display private keys.

## 10. Frontend checklist

- [ ] Send the bearer token on every protected request.
- [ ] Provision the CKB business wallet before expecting wallet credits.
- [ ] Read successful values from `response.result`.
- [ ] Use `response.result.data` for analytical chart points.
- [ ] Refetch after `transaction.confirmed` and `wallet.balance_updated`.
- [ ] Use `cache: 'no-store'` or an equivalent cache-busting strategy.
- [ ] Display wallet balance and processed payment volume as separate metrics.
- [ ] Handle network mismatch errors clearly.
- [ ] Never request or render private keys.
- [ ] Test both CKB testnet and CKB mainnet configuration separately.

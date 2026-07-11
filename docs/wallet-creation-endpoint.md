# Wallet Creation Endpoint Documentation

## Endpoint
**POST** `/api/user/payment-intent/create-wallet`

## Description
Creates or reuses a wallet for a business when a payment intent is initiated for a specific crypto asset. Ensures only one active wallet per business/network at a time. If a second transaction is started during the validity period, a new wallet is deployed for the new transaction.

## Request Body
```
{
  "crypto_currency_id": "string",   // Unique ID of the crypto currency
  "reference_id": "string"          // Reference ID for the payment intent (e.g., payment-intent-id)
}
```

## Authentication
- Requires user authentication (bearer token)

## How It Works
1. **User initiates a payment intent** and selects a crypto asset.
2. **Client calls this endpoint** with the selected `crypto_currency_id` and the `reference_id` for the payment intent.
3. **Controller logic:**
   - Validates the crypto currency and network.
   - Finds the payment intent by `reference_id` and user.
   - Calls `WalletService.createChildWallet` with:
     - `userId` (business/user ID)
     - `cryptoCurrencyId` (selected asset)
     - `refId` (reference_id)
     - (optional) session duration (default 60 min)
   - The service checks:
     - If there is an active wallet for this business/network during the validity period, a new wallet is deployed for the new transaction.
     - If a reusable wallet exists for the same `refId` and is not active, it is reused.
     - Otherwise, a new wallet is created and deployed.
   - The payment intent is updated with the wallet info.
4. **Response:**
   - Returns wallet address, QR code, fiat and crypto details, and expiration time.

## Example Response
```
{
  "error": false,
  "data": {
    "reference_id": "t_cc2c04180",
    "expiration_time": "2026-03-27T12:34:56.000Z",
    "payment_intent_id": "pi_1234567890",
    "fee_in_crypto": 0.3,
    "wallet": {
      "address": "0x123...abc",
      "qr_code": "https://.../qrcode.png"
    },
    "fiat": {
      "name": "Naira",
      "symbol": "NGN",
      "logo": "https://.../ngn.png",
      "amount": 1000
    },
    "crypto": {
      "name": "USDT",
      "symbol": "USDT",
      "logo": "https://.../usdt.png",
      "amount": 1.5,
      "network": {
        "name": "Ethereum",
        "logo": "https://.../eth.png"
      }
    }
  },
  "message": "Payment initiated successfully"
}
```

## Notes
- Only one active wallet per business/network is allowed at a time. Concurrent transactions get new wallets.
- Wallets are reused only if expired or if the same `reference_id` is passed and the wallet is marked reusable.
- Wallets are created after the user selects the asset, not before.
- Session expiration and wallet reuse are handled automatically by the service.

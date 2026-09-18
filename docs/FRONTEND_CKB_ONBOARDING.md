# CKB Onboarding Frontend Contract

Western Treasury should present CCC and CKB as the primary account and payment experience. Other chains may remain available as payment adapters, but the first authenticated identity should be a CKB identity.

## 1. CCC-first sign-in

Use this flow before showing the authenticated dashboard:

1. The frontend obtains a CCC identity from the CCC client.
2. Send a challenge request:

```http
POST /api/user/auth/ccc/challenge
Content-Type: application/json
```

```json
{
  "provider": "ccc",
  "network": "testnet",
  "subject": "<ccc-canonical-subject>"
}
```

3. Ask CCC to sign the returned `result.message`. This is an authentication signature and does not submit a blockchain transaction.
4. Verify the signature:

```http
POST /api/user/auth/ccc/verify
Content-Type: application/json
```

```json
{
  "challengeId": "<challenge-id>",
  "provider": "ccc",
  "network": "testnet",
  "subject": "<ccc-canonical-subject>",
  "identity": "<ccc-canonical-subject>",
  "address": "<ckb-address>",
  "lockScript": "<lock-script>",
  "publicKey": "<public-key>",
  "signature": "<signature>",
  "signType": "<ccc-sign-type>"
}
```

The response returns the normal user token. Store it using the existing authentication strategy. Never store or transmit a private key.

Challenges expire after five minutes and can only be used once. The submitted network must match the backend `CCC_NETWORK` setting.

## 2. Read the linked CKB identity

After verification, load the identity for the account header, wallet page, and payment UI:

```http
GET /api/user/auth/ccc/identity
Authorization: Bearer <user-token>
```

Response shape:

```json
{
  "error": false,
  "result": {
    "identities": [
      {
        "provider": "ccc",
        "network": "testnet",
        "subject": "<ccc-canonical-subject>",
        "address": "ckt1...",
        "lockScript": "...",
        "publicKey": "...",
        "verifiedAt": "...",
        "lastAuthenticatedAt": "..."
      }
    ]
  }
}
```

Display the network clearly. Never label a testnet address as a mainnet address.

## 3. Custody distinction

The CCC identity address is the user's connected identity. It is not the same as:

- a server-controlled custodial `UserWallet`;
- a temporary CKB deposit address generated for a checkout;
- a Fiber invoice address.

Do not show the temporary checkout address as the user's personal wallet. Do not ask the user for a private key.

## 4. CKB/Fiber checkout

For a merchant cart, create checkout normally:

```http
POST /api/cart/checkout
```

Prefer the CKB/Fiber asset when the merchant has enabled it. When the customer selects CKB/Fiber, request the payment destination:

```http
POST /api/cart/wallet
Content-Type: application/json
```

```json
{
  "reference_id": "<checkout-reference>",
  "crypto_currency_id": "<ckb-or-fiber-currency-id>"
}
```

Show the returned wallet address, QR code, network, amount, and expiration. For Fiber, show the invoice as a Fiber payment request.

## 5. Payment status

Poll or subscribe to:

```http
GET /api/payment/status/<reference_id>
GET /api/payment/status/<reference_id>/stream
```

Use these UI states:

- `payment_created`: waiting for the customer to pay;
- `awaiting_confirmation`: payment detected and being verified;
- `payment_completed`: show success and allow order fulfillment;
- anything else or a request error: keep the order pending and show retry/help actions.

Never display success merely because a wallet was created or a transaction was detected. Success requires `payment_completed`.

Completed status responses now include:

```json
{
  "transaction_hash": "0x...",
  "payment_hash": "fiber-payment-hash-or-null",
  "explorer_url": "https://pudge.explorer.nervos.org/transaction/0x..."
}
```

Render `explorer_url` only when it is not null. For Fiber, `payment_hash` may be present even when there is no standard CKB transaction URL.

## 6. Merchant API integrations

External merchants create a hosted session with a secret API key:

```http
POST /api/v1/checkout/sessions
Authorization: Bearer sk_test_...
```

The response contains `checkout_url`. Redirect the customer to that URL. The customer does not need an API key.

Use a test key only with testnet assets and test coins. Use a live key only with mainnet assets. The backend enforces this boundary; the frontend should also filter the asset list to avoid presenting invalid choices.

## 7. Required frontend fixes

- Make `/checkout/confirm/:reference_id` a public route. It must not redirect to merchant login.
- Configure `/api/*` requests to reach the backend origin, not a stale or local URL.
- Replace production `http://localhost:*` image and icon URLs with HTTPS or relative asset URLs.
- Do not open the authenticated user SSE stream for guest checkout customers.
- Show CKB/Fiber as the primary payment option when available.
- Keep non-CKB chains under an explicitly secondary payment option.
- Display CKB network names and Explorer links for confirmed transactions.
- On webhook-driven merchant pages, treat only `payment_completed` or a verified `payment.confirmed` webhook as paid.

## 8. Grant-readiness requirements

The frontend should make it obvious that CKB is the product's core payment and identity layer, not merely one item in a long asset dropdown.

### CKB-first account experience

- Put `Connect with CCC` first on login and signup.
- Explain that CCC creates or connects the user's CKB identity.
- Show the connected CKB address, network, and shortened identity subject in the account header.
- Add a clear `Testnet` badge when `CCC_NETWORK=testnet`.
- Add a network switch screen before changing between CKB testnet and mainnet. Never silently mix the two.
- Add an identity page showing the linked CKB identity and the last authentication time.

### CKB-first checkout experience

- Put CKB/Fiber first in the payment method selector when it is available.
- Label the option clearly, for example `CKB via Fiber` or `CKB on Nervos`.
- Place Paystack and other chains under secondary payment options.
- Show the CKB amount, fiat equivalent, network, invoice or address, QR code, and expiration together.
- Explain that CKB/Fiber payments are confirmed by the backend indexer.
- Show a link to the relevant CKB Explorer transaction after confirmation.

### Payment states reviewers can verify

Create visible states for:

- `Waiting for payment`;
- `Payment detected`;
- `Confirming on CKB/Fiber`;
- `Payment completed`;
- `Expired` or `Payment not received`.

Do not use a generic `Success` screen before `payment_completed`. Include the reference ID, payment hash or transaction hash, network, and confirmation time on the completed receipt.

### CKB adoption metrics

Load the merchant metrics from:

```http
GET /api/user/shop/ckb-metrics
Authorization: Bearer <user-token>
```

The response contains:

```json
{
  "ccc_identities_connected": 1,
  "ckb_payment_intents_created": 10,
  "ckb_payments_completed": 7,
  "fiber_payments_completed": 5,
  "ckb_payment_volume_fiat": 105000,
  "ckb_currencies_used": 2,
  "payment_methods": {
    "ckb": 10,
    "other": 4
  }
}
```

Add a merchant dashboard section that reports these values:

- CCC identities connected;
- CKB/Fiber payment intents created;
- CKB/Fiber payments completed;
- total CKB volume received;
- Fiber invoice payments completed;
- CKB payments compared with other payment methods.

These figures come from backend payment intents and CCC identity records, not browser-only counters. This gives the grant reviewer measurable evidence that users are actually using CKB.

### Network switching and configuration

Load the active CKB/CCC network before rendering identity or payment controls:

```http
GET /api/ckb/config
```

The response includes:

```json
{
  "ckb_network": "testnet",
  "ccc_network": "testnet",
  "switching": false,
  "networks": [
    {
      "uniqueId": "network-id",
      "name": "Nervos CKB Testnet",
      "isTestnet": true,
      "chainKey": "ckb",
      "chainId": null
    }
  ]
}
```

The current deployment selects one network for the backend, so `switching` is currently `false`. The frontend must not pretend that a local toggle changes the backend network. Show the active network, disable incompatible network choices, and require a new deployment/configuration before switching from testnet to mainnet.

### Demonstration mode

Provide a clearly marked CKB testnet demo flow:

- `CKB Testnet` and `Fiber Testnet` labels on every relevant screen;
- links to testnet Explorer pages;
- testnet-only asset filtering for `sk_test_` sessions;
- a sample merchant and product that can be paid with test CKB;
- a confirmation screen showing the real indexed test transaction.

Never present testnet activity as mainnet usage. Keep testnet data separate from live merchant analytics.

### Interoperability positioning

Other chains can remain available, but the UI should explain their role:

- CCC provides the CKB identity layer;
- CKB/Fiber provides the preferred settlement path;
- other chains are optional payment adapters;
- confirmed payment receipts and merchant settlement are tied back to the Western Treasury account and CKB payment flow.

### Evidence to include with the grant submission

Capture a short end-to-end demonstration showing:

1. A new user connects through CCC.
2. The user's CKB testnet identity appears in the account.
3. A merchant creates a CKB/Fiber checkout.
4. The customer pays with test CKB or Fiber.
5. The indexer detects and confirms the payment.
6. The receipt displays the CKB/Fiber payment hash and Explorer link.
7. The merchant dashboard records the completed CKB payment.

Also include screenshots or API responses for the CCC identity, wallet/invoice, payment-status, and completed-receipt steps. This demonstrates CKB-related development directly rather than only showing that CKB appears in a currency list.

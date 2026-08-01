# JUDGE_INSTRUCTIONS.md

## Fiber Node Details for Testing

**P2P address:**
```
/ip4/94.198.190.100/tcp/8228/p2p/QmXuC8TonHKnMZ3bvv8GLH7N8qzPj2Gc3MaXyBWf9tJNZa
```

**RPC pubkey:**
```
020e9f7e29f7dca5c272d2456cc06bd0c09aae7291092dd8c9156c5d71b397a37c
```

**RPC endpoint:**
```
https://94-198-190-100.nip.io
```

## End-to-End Test Steps

1. Connect your test node to this node:
   ```bash
   fnn-cli peer connect_peer --address /ip4/94.198.190.100/tcp/8228/p2p/QmXuC8TonHKnMZ3bvv8GLH7N8qzPj2Gc3MaXyBWf9tJNZa
   ```

2. Get a testnet invoice from the live storefront (checkout selecting Fiber as payment method).

3. Pay the invoice from your node:
   ```bash
   fnn-cli payment send_payment --invoice <the fibt... invoice>
   ```

4. Confirm settlement:
   ```bash
   fnn-cli payment get_payment --payment-hash <payment_hash>
   ```
   Expected: `status: Success`

5. Verify the backend detects the payment via webhook/polling and marks the PaymentIntent as paid.

## Notes

- Testnet CKB can be claimed from the Nervos Pudge Faucet: https://faucet.nervos.org/
- If `send_payment` returns `no path found`, open a direct channel:
  ```bash
  fnn-cli channel open_channel --pubkey 020e9f7e29f7dca5c272d2456cc06bd0c09aae7291092dd8c9156c5d71b397a37c --funding-amount 50000000000
  ```
  Wait for `ChannelReady` via `channel list_channels` before retrying.

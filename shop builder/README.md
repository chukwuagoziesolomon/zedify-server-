# Backend scaffold — stablecoin savings + shop builder

This covers two features discussed:

1. **Fiat → stablecoin savings** — any user deposits ₦, picks RUSD / USDT / USDC,
   gets credited a per-currency wallet balance, notified in real time.
2. **Shop builder backend** — creates a shop on the free default template
   (theming only, zero AI cost), with category-flexible products, matching
   the `yanga_storefront.jsx` frontend built earlier in this conversation.

## What to do with this

- Merge `Currency.ts` into your **existing** Currency model — don't overwrite it,
  it already has fields (`symbol`, `ratePerUsd`, `contractAddress`, `cryptoNetworkId`)
  referenced throughout your existing `PaymentIndexerService`. Only the new
  `isStablecoin` / `pegTarget` / `peggedBy` / `backingInfo` fields are additions.
- Everything else here is new — copy the files into your project's matching
  folders, run the migrations, wire the routes.

## Setup

```bash
# 1. copy migrations, models, services, controllers into your project
# 2. add routes_addition.ts contents into start/routes.ts
# 3. env vars needed:
PAYSTACK_SECRET_KEY=sk_test_...

# 4. run migrations
node ace migration:run

# 5. seed at least one stablecoin currency row per rail, e.g.:
#    RUSD  -> cryptoNetwork: fiber-testnet, isStablecoin: true,
#             pegTarget: "USD", peggedBy: "CKB / Fiber ecosystem"
#    USDT  -> cryptoNetwork: <your evm chain>, isStablecoin: true,
#             pegTarget: "USD", peggedBy: "Tether"
#    USDC  -> similarly, peggedBy: "Circle"
```

## Deliberately stubbed — needs your real provider details

- **`StablecoinConversionService.convertViaFiber`** and **`convertViaEvmOnRamp`** —
  these currently just do a straight `nairaAmount / ratePerUsd` calculation and
  log a stub message. Real conversion needs whichever liquidity partner you
  choose (a DEX swap through Fiber for RUSD, an on-ramp API like Yellow Card
  or Quidax for USDT/USDC). Wire the actual purchase/transfer call in there.
- **Refund/retry path for failed conversions** — right now a failed conversion
  just flips `FiatDeposit.status` to `'failed'` and logs it. Since the NGN was
  already collected at that point, you need a real resolution path (auto-retry,
  or refund to the user) before this handles real money.
- **PaystackService** assumes Paystack. If you're actually using Flutterwave,
  swap the implementation — the rest of the code only depends on
  `initializeCharge` / `verifySignature` existing with these signatures.

## Not built here, worth flagging again

- **Withdrawal / off-ramp** (stablecoin → NGN → bank payout) — users need an
  exit path or the savings feature won't be trusted. Not in this scaffold.
- **Licensing** — as discussed, custodial fiat-to-crypto conversion open to
  any platform user is a different regulatory category than shop payments.
  Get a real read from a Nigerian fintech/crypto lawyer before this handles
  real user funds.
- **AI custom theming** — `ShopBuilderService.markCustomThemeApplied()` is a
  placeholder flag-flip only. The actual AI generation call, credit-checking,
  and billing belongs in its own service once you're ready to build that tier.

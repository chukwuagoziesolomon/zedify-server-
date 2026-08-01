# WT Payments Server

**A full-stack crypto and fiat payment infrastructure for merchants, shops, and marketplaces.**  
Accept crypto payments, process fiat payouts to bank accounts via Paystack, run AI-powered storefronts, and manage withdrawals — all from one backend.

---

## What This Project Does

WT Payments Server is the backend API for the WT Payments platform. It enables:

- **Merchant payments** — customers can pay merchants in crypto (CKB, EVM chains) or fiat (NGN via Paystack)
- **Shop builder** — merchants can create multi-product storefronts with AI-assisted customization
- **Cart & checkout** — customers can add products to a cart and pay via crypto or Paystack fiat
- **Fiat payouts** — merchants can withdraw earnings to Nigerian bank accounts via Paystack
- **Crypto withdrawals** — users can withdraw crypto to external addresses (EVM + CKB/Fiber)
- **Platform fees** — admin-configurable platform fee applied to all incoming payments
- **Real-time notifications** — SSE events + email notifications for orders, payments, and withdrawals
- **Payment indexing** — blockchain/webhook-based payment confirmation with fallback polling

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Framework** | AdonisJS 5 (TypeScript) |
| **Database** | PostgreSQL |
| **ORM** | Lucid |
| **Auth** | AdonisJS Auth (user + admin guards) |
| **Crypto** | ethers.js (EVM), @ckb-lumos/lumos (CKB), fiber-rpc-js (Fiber) |
| **Fiat** | Paystack (charges, transfers, webhooks) |
| **Email** | Nodemailer + Handlebars templates |
| **File uploads** | Cloudinary |
| **Real-time** | Server-Sent Events (SSE) |
| **Prices** | CoinGecko API |
| **Deployment** | Render (backend), Vercel (frontend) |

---

## Project Structure

```
wt-payments-server/
├── app/
│   ├── Controllers/Http/       # HTTP controllers
│   ├── Models/                 # Lucid ORM models
│   ├── Services/               # Business logic services
│   ├── Validators/             # Request validators
│   ├── Lib/                    # Helpers, notifications, types
│   └── helpers/                # Utility functions
├── database/
│   └── migrations/             # Database migrations
├── routes/
│   ├── admin/                  # Admin routes
│   ├── user/                   # Authenticated user routes
│   ├── webhooks/               # Incoming webhook routes
│   └── public.ts               # Public checkout routes
├── start/
│   └── routes.ts               # Route registry
├── docs/                       # API docs and guides
├── tests/functional/           # Functional tests
└── package.json
```

---

## Key Features Breakdown

### 1. Authentication & Users
- User signup/login with JWT
- Admin auth with role-based access (`SUPER_ADMIN`, `ADMIN`)
- Email OTP for withdrawals
- Account verification by admin

### 2. Shops & Products
- Multiple shops per user
- Shop customization (logo, banner, theme, pages)
- AI shop builder with 3-tier memory (buffer, summary, entity)
- Product CRUD with image uploads (Cloudinary)
- Stock tracking and product variants
- Path-based shop URLs (`/shop/:subdomain`) for Vercel hosting

### 3. Cart & Checkout
- Add/update/remove cart items
- Cross-browser/tab sync via SSE
- Checkout with crypto or Paystack fiat
- Single-shop checkout enforcement
- Order confirmation emails

### 4. Payments
- **Crypto:** EVM (ethers.js) and CKB/Fiber invoice-based payments
- **Fiat:** Paystack charge + webhook confirmation
- Payment link generation (`/api/pay/:slug`)
- Payment intent lifecycle (`pending → processing → completed/failed`)
- Real-time SSE updates + email notifications

### 5. Withdrawals
- Crypto withdrawals to external addresses
- Fiat withdrawals to Nigerian bank accounts via Paystack
- OTP confirmation via email
- Live fee calculation and NGN conversion

### 6. Platform Fees
- Admin-configurable platform fee percentage (stored in `system_settings_tb`)
- Applied to all incoming payments
- View/update via admin API

### 7. Notifications
- **SSE events:** cart updates, payment confirmations, wallet balance changes
- **Emails:** order placed, payment received, processing, failed, transfer completed/failed, withdrawal OTP/success

---

## Prerequisites

- Node.js >= 18
- PostgreSQL
- Cloudinary account (for image uploads)
- Paystack account (for fiat payments and payouts)
- CoinGecko API key (optional, free tier works without key)
- SMTP email service (for notifications)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/wt-payments-server.git
cd wt-payments-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Key environment variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_DATABASE=wt_payments

# App
APP_KEY=your-app-key
APP_URL=http://localhost:3335
HOST=localhost
PORT=3333

# Auth
JWT_SECRET=your-jwt-secret

# Blockchain RPCs
CKB_TESTNET_RPC=https://testnet.ckb.dev/rpc
CKB_MAINNET_RPC=https://mainnet.ckb.dev/rpc
FIBER_NODE_URL=http://127.0.0.1:8227
FIBER_NETWORK=testnet

# Payments
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_BASE_URL=https://api.paystack.co

# Email
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=no-reply@example.com
EMAIL_PASS=<password>
EMAIL_FROM_NAME=WT Payments
EMAIL_FROM_EMAIL=no-reply@example.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional
COINGECKO_API_KEY=your-coingecko-key
SHOP_BASE_DOMAIN=localhost:3333
```

### 4. Generate app key

```bash
node ace generate:key
```

### 5. Run migrations

```bash
node ace migration:run
```

### 6. Start the development server

```bash
npm run dev
```

The server will start at `http://localhost:3335`.

### 7. Run tests

```bash
npm test
```

---

## API Documentation

- **Shop, Cart, Checkout API:** `docs/shop-cart-checkout-api.md`
- **Frontend Integration Guide:** `docs/frontend-integration-guide.md`
- **Payment Indexer Setup:** `docs/payment-indexer-setup.md`

---

## Available Routes

View all registered routes:

```bash
node ace list:routes
```

---

## Deployment

### Backend (Render)

1. Connect your GitHub repo to Render
2. Set environment variables in Render dashboard
3. Set `SHOP_BASE_DOMAIN` to your frontend domain
4. Run migrations on first deploy:
   ```bash
   node ace migration:run
   ```

### Frontend (Vercel)

The frontend is a separate Next.js application. Deploy it to Vercel and configure:
- `NEXT_PUBLIC_API_URL` → your Render backend URL
- Shop routes at `/shop/:subdomain`

---

## Testing Fiber Payments

Our production Fiber Network Node is live on CKB testnet, publicly reachable, and ready to accept real routed payments from any Fiber-compatible testnet wallet or node.

### 1. Our node's connection details

**P2P address (for connecting your node):**
```
/ip4/94.198.190.100/tcp/8228/p2p/QmXuC8TonHKnMZ3bvv8GLH7N8qzPj2Gc3MaXyBWf9tJNZa
```

**Public key:**
```
020e9f7e29f7dca5c272d2456cc06bd0c09aae7291092dd8c9156c5d71b397a37c
```

**RPC endpoint (for our own API integration — you shouldn't need this directly):**
```
https://94-198-190-100.nip.io
```

### 2. Connect your node to ours

If you're running `fnn-cli` or an equivalent Fiber node:

```bash
fnn-cli peer connect_peer --address /ip4/94.198.190.100/tcp/8228/p2p/QmXuC8TonHKnMZ3bvv8GLH7N8qzPj2Gc3MaXyBWf9tJNZa
```

### 3. Get a testnet invoice from our live storefront

Visit our deployed storefront, add a product to cart, and check out selecting Fiber as the payment method. This calls our production backend, which generates a real invoice (`fibt…`) directly from the node above.

### 4. Pay it

```bash
fnn-cli payment send_payment --invoice <the fibt... invoice from checkout>
```

**If this returns `no path found`:** our node is connected to the public testnet graph and multiple bootnodes, so a route usually exists — but testnet liquidity can be uneven. If this happens, opening a small direct channel to us guarantees a route:

```bash
fnn-cli channel open_channel --pubkey 020e9f7e29f7dca5c272d2456cc06bd0c09aae7291092dd8c9156c5d71b397a37c --funding-amount 50000000000
```
(500 CKB in shannons; wait for `ChannelReady` via `channel list_channels` before retrying the payment)

### 5. Confirm it settled

```bash
fnn-cli payment get_payment --payment-hash <payment_hash from send_payment>
```
Look for `status: Success`.

### Need testnet CKB?

Claim free testnet CKB from the [Nervos Pudge Faucet](https://faucet.nervos.org/) using your own node's testnet address.

### Questions during testing

Reach us at: [add your contact — Telegram/Discord/email]

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `APP_KEY` | Yes | AdonisJS app key |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | Yes | PostgreSQL connection |
| `JWT_SECRET` | Yes | JWT signing secret |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack API key |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Yes | SMTP credentials |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Yes | Cloudinary uploads |
| `CKB_TESTNET_RPC`, `CKB_MAINNET_RPC` | Yes | CKB blockchain RPCs |
| `FIBER_NODE_URL`, `FIBER_NETWORK` | Yes | Fiber node connection |
| `COINGECKO_API_KEY` | No | CoinGecko price feeds |
| `SHOP_BASE_DOMAIN` | No | Frontend domain for shop URLs |
| `CLIENT_URL` | No | CORS allowed origin |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

Proprietary — All rights reserved.

---

## Support

For issues and feature requests, please open an issue on GitHub.

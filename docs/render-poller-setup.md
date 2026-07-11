# Running Payment Poller on Render

## Overview

Render can run **multiple process types** from the same repo. You need:

| Process | Type | Command | Purpose |
|---|---|---|---|
| Web server | **Web Service** | `node build/server.js` | Serves API to frontend |
| Payment poller | **Cron Job** | `node build/ace poll:payments` | Polls blockchain for pending payments |

For **free tier** users, use **Render Cron Jobs** instead of a Background Worker.

---

## Option 1: Render Cron Job (Free Tier)

### 1. Create a Cron Job in Render Dashboard

1. Go to your Render dashboard
2. Click **New +** → **Cron Job**
3. Connect the **same Git repo** as your web service
4. Configure:

| Field | Value |
|---|---|
| **Name** | `poll-payments` |
| **Schedule** | `*/1 * * * *` (every 1 minute) |
| **Command** | `node build/ace poll:payments` |
| **Branch** | `main` (or your branch) |

### 2. Set Environment Variables

The cron job needs the **same env vars** as your web service.

**Important:** In Render, go to your Cron Job → **Environment** tab and add all the same env vars from your web service:
- `NODE_ENV=production`
- `DB_CONNECTION=pg`
- `DB_HOST=...`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `DB_DATABASE=...`
- `CKB_TESTNET_RPC=...`
- `FIBER_NODE_URL=...`
- `FIBER_NETWORK=...`
- `WEBHOOK_SECRET=...`
- `COINGECKO_API_KEY=...`
- `CLOUDINARY_CLOUD_NAME=...`
- etc.

**Tip:** Use Render's **Environment Groups** to share env vars between your web service and cron job. This avoids duplicating config.

### 3. How It Works

Render will:
1. Clone your repo
2. Run `npm install && npm run build`
3. Execute `node build/ace poll:payments`
4. The poller boots the AdonisJS app, runs one poll cycle, then exits

Each cron trigger runs a **fresh process**, so there's no risk of disturbing real-time users. The web service is completely separate.

### 4. Monitor Logs

In Render dashboard → your Cron Job → **Logs**:

```
2026-07-14 14:53:00 [INFO] 🔍 Starting payment polling
2026-07-14 14:53:00 [INFO] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-07-14 14:53:00 [INFO] [2026-07-14T14:53:00.000Z] Running poll cycle…
2026-07-14 14:53:01 [INFO] [PaymentIndexer] Polling completed. Checked 6 intents
2026-07-14 14:53:01 [SUCCESS] ✓ Poll cycle completed
```

---

## Option 2: Background Worker (Paid Tier)

If you upgrade to Render's Starter plan ($7/month), you can use a Background Worker for real-time polling every 30 seconds.

### Setup

| Field | Value |
|---|---|
| **Name** | `wt-payments-poller` |
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node build/ace poll:payments --watch --interval=30` |

The worker runs continuously, polling every 30 seconds.

---

## Option 3: PM2 in One Service (Advanced)

Run both the web server and poller in one Render service using PM2.

### 1. Install PM2

```bash
npm install --save-dev pm2
```

### 2. Create `ecosystem.config.js`

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'web',
      script: 'node',
      args: 'build/server.js',
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'poller',
      script: 'node',
      args: 'build/ace poll:payments --watch --interval=30',
      watch: false,
      env: { NODE_ENV: 'production' },
    },
  ],
}
```

### 3. Update Render Start Command

```bash
pm2-runtime start ecosystem.config.js
```

---

## Cron Job Schedule Reference

Render Cron Jobs support standard cron syntax:

| Schedule | Meaning |
|---|---|
| `*/1 * * * *` | Every 1 minute |
| `*/5 * * * *` | Every 5 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `0 * * * *` | Every hour |
| `*/30 * * * *` | Every 30 minutes |

For payment polling, **every 1 minute** is recommended:
```
*/1 * * * *
```

---

## Environment Variables for Production

Minimum required in Render:

```env
# Server
NODE_ENV=production
PORT=3335
HOST=0.0.0.0
APP_KEY=<your-app-key>
APP_URL=https://your-api-domain.onrender.com

# Database
DB_CONNECTION=pg
DB_HOST=<your-postgres-host>
DB_PORT=5432
DB_USER=<your-postgres-user>
DB_PASSWORD=<your-postgres-password>
DB_DATABASE=wt_payments

# Blockchain
CKB_TESTNET_RPC=https://testnet.ckb.dev/rpc
FIBER_NODE_URL=<your-fiber-node>
FIBER_NETWORK=testnet
FIBER_BISCUIT_TOKEN=<your-biscuit-token>

# External APIs
COINGECKO_API_KEY=<your-coingecko-key>
COINGECKO_API_BASE=https://api.coingecko.com/api/v3

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=<your-smtp-password>
SMTP_FROM_NAME=WT Payments
SMTP_FROM_EMAIL=no-reply@example.com

# AI Shop Builder
ANTHROPIC_API_KEY=<your-anthropic-key>
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
SHOP_BASE_DOMAIN=yourdomain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud>
CLOUDINARY_API_KEY=<your-cloudinary-key>
CLOUDINARY_API_SECRET=<your-cloudinary-secret>

# Webhooks
WEBHOOK_SECRET=<your-webhook-secret>
```

---

## Testing Locally

Before deploying, test the poller locally:

```bash
# Single run (processes pending payments once)
node ace poll:payments

# Continuous mode (polls every 30 seconds)
node ace poll:payments --watch --interval=30
```

To test with production data, temporarily set your local `.env` to point to your production database.

---

## Troubleshooting

### "Cannot find module" errors

Make sure the Render build command includes TypeScript compilation:
```bash
npm install && npm run build
```

The `build` script is:
```
node ace build --production --ignore-ts-errors
```

### Cron job runs but no payments processed

Check Render logs for:
- `[PaymentIndexer] No pending payment intents` — no pending payments in DB (normal if all caught up)
- `[PaymentIndexer] CKB payment check failed` — RPC/node issues
- `[PaymentIndexer] Fiber invoice check failed` — Fiber node issues

### Database connection errors

Make sure:
1. `DB_HOST` is your Render PostgreSQL host (not `localhost`)
2. `DB_PORT=5432`
3. Your PostgreSQL database allows connections from Render's IPs

---

## Cost Estimate (Render)

| Option | Monthly Cost | Use Case |
|---|---|---|
| Free Tier + Cron Job | $0 | Testing, low volume |
| Starter Plan + Background Worker | $7 | Production, real-time updates |
| Standard Plan + Background Worker | $25 | High volume, multiple workers |

---

## Recommendation

**Free tier:** Use **Option 1 (Cron Job)** with `*/1 * * * *` schedule. It's free and reliable enough for most use cases.

**Paid tier:** Use **Option 2 (Background Worker)** for true 30-second polling without cold starts.


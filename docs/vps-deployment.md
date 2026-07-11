# VPS Deployment Guide

Deploy `wt-payments-server` to your VPS at `185.246.189.116` (user: `algo`).

## Architecture options

**Option A — Both on this VPS (recommended while starting out)**
- Adonis server on port `3335`
- FNN on `127.0.0.1:8227`
- `.env` uses `FIBER_NODE_URL=http://127.0.0.1:8227`
- No Render dependency for backend operations

**Option B — Split**
- Adonis server on Render
- FNN on this VPS behind Caddy
- `.env` uses `FIBER_NODE_URL=https://your-fnn-host.example.com`

The commands below assume **Option A**. For Option B, change `FIBER_NODE_URL` and put Caddy in front of FNN.

## Prerequisites on VPS

- Node.js v18+
- npm
- unzip
- PostgreSQL database (local or remote)

## One-time setup on VPS

```bash
# SSH into VPS
ssh algo@185.246.189.116

# Create project directory
mkdir -p /home/algo/wt-payments-server
cd /home/algo/wt-payments-server
```

## Prepare deploy.zip locally (Windows)

From the project root on your Windows machine:

```powershell
npm install
npm run build
$Exclude = @("node_modules", ".git", "build", ".env", "deploy", "docs", "*.log", ".adonis")
Compress-Archive -Path * -DestinationPath C:\Users\USER-PC\wt-payments-server\deploy.zip -Force
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
```

## Transfer and deploy

```powershell
pscp -P 22 -hostkey "ssh-ed25519 255 SHA256:QQmGros+IInDDN+DfyJ1R9UtBQXDXszy5c4PPGXVcLc" C:\Users\USER-PC\wt-payments-server\deploy.zip algo@185.246.189.116:/tmp/
```

Then SSH:
```bash
ssh algo@185.246.189.116
cd /home/algo
unzip -o /tmp/deploy.zip -d wt-payments-server
rm /tmp/deploy.zip
cd wt-payments-server
npm install --production
npm run build
```

Create `.env` on the VPS:
```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=3335
HOST=0.0.0.0
APP_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
APP_URL=http://185.246.189.116:3335

DB_CONNECTION=pg
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=algo
DB_PASSWORD=<your-postgres-password>
DB_DATABASE=wt_payments

CKB_TESTNET_RPC=https://testnet.ckb.dev/rpc
CKB_MAINNET_RPC=https://mainnet.ckb.dev/rpc

FIBER_NODE_URL=http://127.0.0.1:8227
FIBER_NETWORK=testnet
FIBER_BISCUIT_TOKEN=

WEBHOOK_SECRET=global-fallback-secret
APP_ENV=production

ANTHROPIC_API_KEY=<your-anthropic-key>
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
SHOP_BASE_DOMAIN=yourdomain.com

PAYSTACK_SECRET_KEY=<replace-me>
PAYSTACK_BASE_URL=https://api.paystack.co

CLIENT_URL=http://localhost:3200
EOF
```

Run migrations:
```bash
node build/ace migration:run
```

Start the server:
```bash
pkill -f 'node build/server.js' || true
sleep 2
nohup node build/server.js > server.log 2>&1 &
```

Verify:
```bash
curl http://127.0.0.1:3335/api/user/fiber/node-info
tail -f server.log
```

## Systemd service (recommended)

```bash
sudo tee /etc/systemd/system/wt-payments-server.service > /dev/null << 'EOF'
[Unit]
Description=WT Payments Server (AdonisJS)
After=network.target

[Service]
Type=simple
User=algo
WorkingDirectory=/home/algo/wt-payments-server
ExecStart=/usr/bin/node build/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/algo/wt-payments-server/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now wt-payments-server
sudo journalctl -u wt-payments-server -f
```

Press `Ctrl+C` to stop tailing logs once you see it listening.

## Ports

- `3335`: this Adonis server
- `3000`: Dokploy
- `3002`: available
- `8227`: FNN RPC (localhost only)

## Post-deploy checklist

- [ ] `.env` is present and secrets are set
- [ ] `node build/ace migration:run` completed
- [ ] `curl http://127.0.0.1:3335/api/user/fiber/node-info` returns JSON (expected error if FNN isn’t running yet)
- [ ] `server.log` or `journalctl` shows Adonis listening

## Next: run FNN on this VPS

```bash
ssh algo@185.246.189.116
mkdir -p /home/algo/fnn/ckb
cd /home/algo/fnn
# copy fnn, fnn-cli, config.yml, and ckb/key here
FIBER_SECRET_KEY_PASSWORD='your-strong-password' RUST_LOG=info ./fnn -c config.yml -d .
```

Verify:
```bash
./fnn-cli info
```

Fund the testnet address, open channels, then retry `GET /api/user/fiber/node-info` from the Adonis server.

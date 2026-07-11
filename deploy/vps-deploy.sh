#!/bin/bash
set -e

PROJECT_NAME="wt-payments-server"
PROJECT_DIR="/home/algo/${PROJECT_NAME}"
DEPLOY_ZIP="/tmp/deploy.zip"
LOG_FILE="${PROJECT_DIR}/server.log"

echo "==> Deploying ${PROJECT_NAME} to ${PROJECT_DIR}"

# 1. Extract
echo "==> Extracting ${DEPLOY_ZIP} -> ${PROJECT_DIR}"
mkdir -p "${PROJECT_DIR}"
unzip -o "${DEPLOY_ZIP}" -d "${PROJECT_DIR}"
rm -f "${DEPLOY_ZIP}"

# 2. Install dependencies (production only)
echo "==> Installing dependencies"
cd "${PROJECT_DIR}"
npm install --production

# 3. Build TypeScript -> build/server.js
echo "==> Building AdonisJS"
npm run build

# 4. Ensure .env exists
if [ ! -f "${PROJECT_DIR}/.env" ]; then
  echo "==> WARNING: .env not found. Copy .env.example or create .env before starting."
fi

# 5. Run migrations
echo "==> Running migrations"
node build/ace migration:run || true

# 6. Restart server
echo "==> Restarting server"
pkill -f 'node build/server.js' || true
sleep 2
nohup node build/server.js > "${LOG_FILE}" 2>&1 &

echo "==> Deployment complete. Logs: ${LOG_FILE}"
echo "==> Verify: curl http://127.0.0.1:3335/api/user/fiber/node-info"

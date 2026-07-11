# Crypto Payment Indexer & Email Notification System

## Overview

This implementation provides a **hybrid payment confirmation system** for cryptocurrency transactions with beautiful email notifications.

### Components

1. **PaymentIndexerService** - Real-time payment detection via webhooks + fallback polling
2. **PaymentWebhookController** - API endpoints for receiving/triggering payment events
3. **Email Templates** - Beautiful, responsive HTML email templates
4. **Poll Command** - Ace command for periodic blockchain polling
5. **Payment Confirmation Flow** - Automatic email notifications to businesses and admins

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PAYMENT RECEIVED ON CHAIN                  │
└────────────────┬──────────────────────────┬─────────────────┘
                 │                          │
        PRIMARY DETECTION          FALLBACK DETECTION
                 │                          │
      ┌──────────│──────────┐       ┌──────│──────────┐
      │                     │       │               │
   Webhook from         Manual Polling         Cron Job
   Alchemy/Tenderly     (API Call)             (Scheduler)
      │                     │       │               │
      └──────────┬──────────┘       └───────┬───────┘
                 │                         │
          ┌──────▼─────────────────────────▼──────┐
          │   PaymentIndexerService                 │
          │ - Verify amount matches                 │
          │ - Update PaymentIntent status           │
          │ - Trigger notifications                 │
          └──────┬───────────────────────┬──────────┘
                 │                       │
       ┌─────────▼────┐        ┌────────▼──────────┐
       │ Database Txn │        │ Email Service      │
       │ - Confirm    │        │ - Business owner   │
       │ - Complete   │        │ - Admins           │
       └──────────────┘        └────────┬───────────┘
                                       │
                              ┌────────▼──────────┐
                              │   Email Templates  │
                              │ - payment_received │
                              │ - admin_received   │
                              │ - processing       │
                              │ - failed           │
                              └───────────────────┘
```

---

## API Endpoints

### 1. Webhook Handler (Primary Detection)
**POST** `/api/webhooks/payment`

Receives real-time payment events from blockchain indexers (Alchemy, Tenderly, The Graph, etc.)

**Payload Format** (supports multiple sources):

```json
{
  "source": "alchemy",
  "signature": "hmac_sha256_signature",
  "event": {
    "activity": [
      {
        "hash": "0x...",
        "from": "0x...",
        "to": "0x...",
        "value": "1000000000000000000",
        "blockNum": "12345"
      }
    ],
    "chainId": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received",
  "txHash": "0x..."
}
```

### 2. Manual Polling Trigger
**POST** `/api/webhooks/payment/poll`

Manually trigger blockchain polling to check for missed payments.

**Response:**
```json
{
  "success": true,
  "message": "Polling initiated"
}
```

### 3. Health Check
**GET** `/api/webhooks/payment/health`

Check if the webhook service is running and healthy.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "PaymentWebhookService",
  "timestamp": "2026-04-04T12:00:00.000Z"
}
```

---

## Setup Instructions

### 1. Environment Configuration

Add to your `.env` file:

```env
# Webhook Security
WEBHOOK_SECRET=your_secret_key_for_hmac_validation

# Email Configuration (already configured)
MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=465
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password

# RPC URLs for polling (map these to CryptoNetwork records)
ETH_MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHEREUM_MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 2. Database Requirements

The system uses existing tables:
- `payment_intents` - Payment intent records
- `wallets` - Wallet addresses for payments
- `crypto_networks` - Network/chain configuration
- `currencies` - Currency conversion rates
- `business_settings` - Webhook URLs & API keys

### 3. Webhook Provider Setup

#### Alchemy Webhook
1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com)
2. Create a new webhook
3. Configure webhook URL: `https://your-domain.com/api/webhooks/payment`
4. Select "Address Activity" for event type
5. Add wallet addresses to monitor
6. Copy the webhook ID and secret

#### Tenderly Webhook
1. Go to [Tenderly Dashboard](https://dashboard.tenderly.co)
2. Create alert/notification
3. Webhook URL: `https://your-domain.com/api/webhooks/payment`
4. Set custom payload with transaction hash and amount

#### The Graph (Subgraph)
1. Create a custom subgraph for your wallet addresses
2. Poll the subgraph endpoint periodically
3. Call the polling endpoint when transactions detected

### 4. Enable Scheduled Polling

Add to your `ace.json` (Ace scheduler configuration):

```json
{
  "schedules": [
    {
      "command": "poll:payments",
      "schedule": "*/5 * * * *",
      "description": "Poll blockchain for pending payments every 5 minutes"
    }
  ]
}
```

Or run manually:
```bash
node ace poll:payments
```

---

## Email Templates

### 1. **payment_received.html** - Business Owner
Sent when payment is confirmed on-chain. Beautiful gradient header, amount display, transaction details.

**Variables:**
- `businessName` - Business name
- `paymentId` - Unique payment ID
- `businessRefId` - Business reference
- `cryptoAmount` - Amount received (crypto)
- `cryptoCurrency` - Cryptocurrency symbol
- `fiatAmount` - Equivalent in fiat
- `fiatCurrency` - Fiat currency symbol
- `walletAddress` - Receiving wallet address
- `confirmedAt` - Confirmation timestamp
- `transactionHash` - Blockchain transaction hash
- `explorerUrl` - Link to blockchain explorer

### 2. **admin_payment_received.html** - Admin Notification
Sent to all admins with detailed payment info and action buttons.

**Variables:** Same as above plus `adminName`, `businessId`

### 3. **payment_processing.html** - Processing Status
Sent when payment is detected but waiting for confirmations.

**Variables:**
- `businessName`
- `paymentId`
- `cryptoAmount`
- `cryptoCurrency`
- `fiatAmount`
- `fiatCurrency` 
- `walletAddress`
- `submittedAt`

### 4. **payment_failed.html** - Expiration Notice
Sent when payment window expires (1 hour default).

**Variables:**
- `businessName`
- `paymentId`
- `businessRefId`
- `fiatAmount`
- `fiatCurrency`
- `expiredAt`

---

## Payment Flow

### 1. Payment Confirmation Detected
```
Transaction arrives → Webhook received/Polling detects → Validate amount
```

### 2. Status Update
```
PaymentIntent status: PENDING → CONFIRMED → COMPLETED
Wallet status: ACTIVE → RECEIVED_PAYMENT
```

### 3. Notifications Triggered
```
- Email to business owner
- Email to all admins
- Webhook to business's configured URL
- Log to system
```

### 4. Settlement Queue
```
Wallet marked for settlement → Scheduled flush to master wallet → Completion
```

---

## Configuration & Customization

### Tolerance Settings

In `PaymentIndexerService`, adjust the amount tolerance:
```typescript
const tolerance = expectedAmount * 0.01; // Allow 1% variance
```

### Confirmation Requirements

In `PaymentIndexerService`, adjust required confirmations:
```typescript
// Currently checks if balance >= expected * 0.99
// For more strict: change to 1.0
// For more lenient: change to 0.95
```

### Webhook Retry Logic

In `PaymentIndexerService.sendWebhookWithRetry()`:
```typescript
// Exponential backoff: 1s, 2s, 4s
const delay = Math.pow(2, i) * 1000
```

### Email Sender

Configure in `EmailNotificationService`:
```typescript
// Update sender email, add custom headers, etc.
```

---

## Monitoring & Debugging

### View Payment Status
```typescript
// Check PaymentIntent status
const payment = await PaymentIntent.find(id)
console.log(payment.status) // pending, confirmed, completed
console.log(payment.receivedPaymentAt) // When detected
console.log(payment.completedAt) // When settled
```

### Check Webhook Logs
```bash
# View recent payment indexer logs
grep "PaymentIndexer\|PaymentWebhook" /path/to/logs/*.log

# In real-time
tail -f /path/to/logs/app.log | grep "Payment"
```

### Manually Trigger Polling
```bash
# Check one payment
curl -X POST http://localhost:3333/api/webhooks/payment/poll

# Schedule periodic checks
*/5 * * * * /usr/bin/curl http://localhost:3333/api/webhooks/payment/poll
```

### Test Webhook Handler
```bash
curl -X POST http://localhost:3333/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{
    "transactionHash": "0x...",
    "walletAddress": "0x...",
    "cryptoAmount": 1.5,
    "chainId": 1,
    "blockNumber": 12345,
    "timestamp": 1712246400
  }'
```

---

## Error Handling

### Transaction Amount Mismatch
```
Log: Amount mismatch. Expected: X, Received: Y
Action: Webhook processed but payment not marked confirmed
```

### Wallet Not Found
```
Log: Wallet not found for address: 0x...
Action: Webhook ignored (may need wallet creation first)
```

### Email Failure
```
Log: Failed to send email notifications
Action: Payment still confirmed, but business not notified
Resolution: Emails can be resent manually from dashboard
```

### Network RPC Error
```
Log: Error checking status for wallet [address]
Action: Payment marked as pending, will retry on next poll
```

---

## Performance Considerations

1. **Webhook Processing**: Async - returns 200 immediately, processes in background
2. **Polling Interval**: Default 5 minutes (configurable via scheduler)
3. **Database Transactions**: Uses row-level locking to prevent race conditions
4. **Rate Limiting**: None currently - add to production
5. **Email Batching**: Each payment sends individual emails (can batch if needed)

---

## Security Considerations

1. **Webhook Validation**: HMAC-SHA256 signature verification (optional but recommended)
2. **Amount Verification**: 1% tolerance prevents small amount mismatches
3. **Database Transactions**: Prevents duplicate confirmations
4. **Rate Limiting**: Add middleware to prevent abuse
5. **Webhook Secret**: Use strong secret in production, never commit to .git

---

## Troubleshooting

### Payments not confirming
1. Check RPC URL is correct and accessible
2. Verify wallet address exists on chain
3. Check if amount is in tolerance range
4. Review logs for specific error

### Emails not sending
1. Verify SMTP credentials in .env
2. Check EmailNotificationService logs
3. Ensure template files exist in correct path
4. Test with `sendTestEmail()` command

### Webhook not received
1. Verify webhook URL is public and accessible
2. Check firewall/CORS settings
3. Test with `POST /api/webhooks/payment/health`
4. Verify webhook provider credentials
5. Check application logs for parse errors

### High database load
1. Reduce polling frequency
2. Add indexes to payment_intents table
3. Implement caching layer for conversions rates
4. Consider async email queue

---

## Next Steps

1. ✅ **Webhook Setup**: Configure Alchemy/Tenderly webhook
2. ✅ **Environment**: Set up .env variables
3. ✅ **Testing**: Test payment flow end-to-end
4. ✅ **Scheduling**: Enable scheduler for periodic polling
5. ⏳ **Settlement**: Implement wallet settlement job
6. ⏳ **Dashboard**: Add payment status views in UI
7. ⏳ **Notifications**: Add SMS/push notifications as backup

---

## Support

For issues or questions:
- Check logs: `grep -i "payment\|webhook\|indexer" logs/*.log`
- Test health: `curl http://localhost:3333/api/webhooks/payment/health`
- Review this documentation
- Contact support team

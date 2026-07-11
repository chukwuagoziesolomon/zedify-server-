# Frontend Integration Guide - Fiber Payments

**Version:** 1.0.0  
**Last Updated:** July 10, 2026  
**Target Audience:** Frontend Developers

---

## Table of Contents

1. [Setup](#setup)
2. [API Client Configuration](#api-client-configuration)
3. [Component Examples](#component-examples)
4. [Real-time Updates](#real-time-updates)
5. [Error Handling](#error-handling)
6. [Testing](#testing)

---

## Setup

### Installation

```bash
# Install HTTP client (if using axios)
npm install axios

# Install QR code library
npm install qrcode.react

# Install UI components
npm install react-toastify
```

### Environment Variables

Create `.env.local`:
```
REACT_APP_API_URL=http://localhost:3333
REACT_APP_ENV=development
```

---

## API Client Configuration

### Create API Service

**`services/fiberPaymentService.ts`**

```typescript
import axios, { AxiosInstance } from 'axios'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  code?: string
}

class FiberPaymentService {
  private api: AxiosInstance
  private token: string | null = null

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3333',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    // Handle response errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(token: string) {
    this.token = token
  }

  // ============ FIBER SETUP ============

  async setupFiber(params: {
    fiberChannelId: string
    fiberPeerId: string
    fiberNodeUrl: string
    acceptCkb?: boolean
    acceptSudt?: boolean
    autoConvertDaily?: boolean
    autoConvertThreshold?: number
    settlementSchedule?: 'daily' | 'weekly' | 'monthly' | 'manual'
  }) {
    const response = await this.api.post<ApiResponse<any>>(
      '/api/business/fiber/setup',
      params
    )
    return response.data.data
  }

  async getFiberSettings() {
    const response = await this.api.get<ApiResponse<any>>(
      '/api/business/fiber/setup'
    )
    return response.data.data
  }

  async updateSettlement(params: {
    autoConvertDaily?: boolean
    autoConvertThreshold?: number
    settlementSchedule?: string
  }) {
    const response = await this.api.patch<ApiResponse<any>>(
      '/api/business/fiber/settlement',
      params
    )
    return response.data.data
  }

  async disableFiber() {
    const response = await this.api.post<ApiResponse<any>>(
      '/api/business/fiber/disable'
    )
    return response.data.data
  }

  // ============ SUDT TOKENS ============

  async getAvailableSudt(limit = 50, offset = 0) {
    const response = await this.api.get<ApiResponse<any[]>>(
      '/api/business/fiber/available-sudt',
      { params: { limit, offset } }
    )
    return response.data.data
  }

  async addSudt(params: {
    sudtTypeScript: {
      code_hash: string
      hash_type: string
      args: string
    }
    symbol: string
    name: string
    logo?: string
    autoConvertEnabled?: boolean
  }) {
    const response = await this.api.post<ApiResponse<any>>(
      '/api/business/fiber/accept-sudt',
      params
    )
    return response.data.data
  }

  async getAcceptedSudt(limit = 50, offset = 0) {
    const response = await this.api.get<ApiResponse<any[]>>(
      '/api/business/fiber/accepted-sudt',
      { params: { limit, offset } }
    )
    return response.data.data
  }

  async removeSudt(typeScript: string) {
    const response = await this.api.delete<ApiResponse<any>>(
      `/api/business/fiber/accept-sudt/${typeScript}`
    )
    return response.data.data
  }

  // ============ PAYMENTS ============

  async createPaymentIntent(params: {
    businessId: string
    fiatAmount: number
    fiatCurrency: string
    cryptoNetworkId: string
    cryptoCurrency: string
    sudtTypeScript?: object
    sudtSymbol?: string
    description?: string
    businessReferenceId?: string
    expiryMinutes?: number
  }) {
    const response = await this.api.post<ApiResponse<any>>(
      '/api/payment-intents',
      params
    )
    return response.data.data
  }

  async getPaymentHistory(
    limit = 50,
    offset = 0,
    status?: string,
    currency?: string
  ) {
    const response = await this.api.get<ApiResponse<any[]>>(
      '/api/business/fiber/payments',
      { params: { limit, offset, status, currency } }
    )
    return response.data
  }

  async getStats(period = '30d') {
    const response = await this.api.get<ApiResponse<any>>(
      '/api/business/fiber/stats',
      { params: { period } }
    )
    return response.data.data
  }

  async settleNow() {
    const response = await this.api.post<ApiResponse<any>>(
      '/api/business/fiber/settle-now',
      {}
    )
    return response.data.data
  }
}

export default new FiberPaymentService()
```

---

## Component Examples

### 1. Fiber Setup Form

**`components/FiberSetup.tsx`**

```typescript
import React, { useState } from 'react'
import fiberPaymentService from '../services/fiberPaymentService'
import { toast } from 'react-toastify'

export const FiberSetup: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fiberChannelId: '',
    fiberPeerId: '',
    fiberNodeUrl: 'http://127.0.0.1:8227',
    acceptCkb: true,
    acceptSudt: true,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await fiberPaymentService.setupFiber(formData)
      toast.success('Fiber enabled successfully!')
      console.log('Setup result:', result)
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          'Failed to enable Fiber'
      )
      console.error('Setup error:', error.response?.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fiber-setup-form">
      <h2>Enable Fiber Payments</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fiberChannelId">
            Fiber Channel ID
          </label>
          <input
            type="text"
            id="fiberChannelId"
            name="fiberChannelId"
            value={formData.fiberChannelId}
            onChange={handleChange}
            required
            placeholder="ckt1qzda89..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="fiberPeerId">Fiber Peer ID</label>
          <input
            type="text"
            id="fiberPeerId"
            name="fiberPeerId"
            value={formData.fiberPeerId}
            onChange={handleChange}
            required
            placeholder="0x..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="fiberNodeUrl">
            Fiber Node URL
          </label>
          <input
            type="url"
            id="fiberNodeUrl"
            name="fiberNodeUrl"
            value={formData.fiberNodeUrl}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group checkbox">
          <input
            type="checkbox"
            id="acceptCkb"
            name="acceptCkb"
            checked={formData.acceptCkb}
            onChange={handleChange}
          />
          <label htmlFor="acceptCkb">
            Accept CKB Payments
          </label>
        </div>

        <div className="form-group checkbox">
          <input
            type="checkbox"
            id="acceptSudt"
            name="acceptSudt"
            checked={formData.acceptSudt}
            onChange={handleChange}
          />
          <label htmlFor="acceptSudt">
            Accept SUDT Tokens
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Enabling...' : 'Enable Fiber'}
        </button>
      </form>
    </div>
  )
}
```

### 2. Create Payment Intent

**`components/CreatePayment.tsx`**

```typescript
import React, { useState } from 'react'
import QRCode from 'qrcode.react'
import fiberPaymentService from '../services/fiberPaymentService'
import { toast } from 'react-toastify'

export const CreatePayment: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState<any>(null)
  const [formData, setFormData] = useState({
    businessId: 'bus_123', // Set from auth
    fiatAmount: 100,
    fiatCurrency: 'USD',
    cryptoNetworkId: 'fiber-testnet',
    cryptoCurrency: 'CKB',
    description: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'fiatAmount' ? parseFloat(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result =
        await fiberPaymentService.createPaymentIntent(
          formData
        )
      setPayment(result)
      toast.success('Payment intent created!')
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          'Failed to create payment'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-payment">
      <h2>Create Payment Invoice</h2>

      {!payment ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fiatAmount">Amount (USD)</label>
            <input
              type="number"
              id="fiatAmount"
              name="fiatAmount"
              value={formData.fiatAmount}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">
              Description (Optional)
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Order #123"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </form>
      ) : (
        <div className="payment-display">
          <div className="qr-container">
            <QRCode
              value={payment.walletAddress}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="payment-details">
            <div className="detail-row">
              <span className="label">Amount (USD):</span>
              <span className="value">
                ${payment.fiatAmount}
              </span>
            </div>

            <div className="detail-row">
              <span className="label">Crypto Amount:</span>
              <span className="value">
                {payment.amountCrypto} {payment.currency}
              </span>
            </div>

            <div className="detail-row">
              <span className="label">Payment Address:</span>
              <div className="address-display">
                <code>{payment.walletAddress}</code>
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      payment.walletAddress
                    )
                    toast.success('Copied to clipboard!')
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="detail-row">
              <span className="label">Expires:</span>
              <span className="value">
                <ExpiryTimer
                  expiresAt={payment.expiresAt}
                />
              </span>
            </div>
          </div>

          <button
            onClick={() => setPayment(null)}
            className="btn btn-secondary"
          >
            Create Another
          </button>
        </div>
      )}
    </div>
  )
}

// Helper component
const ExpiryTimer: React.FC<{
  expiresAt: string
}> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = React.useState('')

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const expiry = new Date(expiresAt)
      const diff = expiry.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Expired')
      } else {
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${minutes}m ${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return <span>{timeLeft}</span>
}
```

### 3. Payment Monitor (Real-time Updates)

**`components/PaymentMonitor.tsx`**

```typescript
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

interface PaymentUpdate {
  payment_id: string
  amount_received: number
  currency: string
  timestamp: string
}

export const PaymentMonitor: React.FC<{
  businessId: string
}> = ({ businessId }) => {
  const [payments, setPayments] = useState<PaymentUpdate[]>(
    []
  )
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Get auth token
    const token = localStorage.getItem('auth_token')
    if (!token) return

    // Connect to SSE stream
    const eventSource = new EventSource(
      `/api/payments/stream?businessId=${businessId}&token=${token}`
    )

    eventSource.addEventListener('open', () => {
      setConnected(true)
      console.log('Connected to payment stream')
    })

    eventSource.addEventListener('payment.completed', (event) => {
      const payment = JSON.parse(event.data)

      // Add to list
      setPayments((prev) => [payment, ...prev])

      // Show notification
      toast.success(
        `Payment received: ${payment.amount_received} ${payment.currency}`,
        {
          position: 'bottom-right',
          autoClose: 5000,
        }
      )

      // Play sound (optional)
      playNotificationSound()
    })

    eventSource.addEventListener('error', () => {
      setConnected(false)
      console.error('Payment stream error')
      eventSource.close()
    })

    return () => eventSource.close()
  }, [businessId])

  return (
    <div className="payment-monitor">
      <div className="monitor-header">
        <h3>Recent Payments</h3>
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Live' : '🔴 Offline'}
        </span>
      </div>

      {payments.length === 0 ? (
        <p className="empty-state">
          No payments yet. Waiting for incoming payments...
        </p>
      ) : (
        <div className="payment-list">
          {payments.map((payment) => (
            <div
              key={payment.payment_id}
              className="payment-item"
            >
              <div className="payment-amount">
                +{payment.amount_received} {payment.currency}
              </div>
              <div className="payment-time">
                {new Date(
                  payment.timestamp
                ).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const playNotificationSound = () => {
  const audio = new Audio(
    'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
  )
  audio.play().catch(() => {})
}
```

### 4. Payment History

**`components/PaymentHistory.tsx`**

```typescript
import React, { useState, useEffect } from 'react'
import fiberPaymentService from '../services/fiberPaymentService'

export const PaymentHistory: React.FC<{
  businessId: string
}> = ({ businessId }) => {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const limit = 10

  useEffect(() => {
    loadPayments()
  }, [page])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const result = await fiberPaymentService.getPaymentHistory(
        limit,
        page * limit,
        'completed'
      )
      setPayments(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (error) {
      console.error('Failed to load payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="payment-history">
      <h2>Payment History</h2>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <table className="payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (Crypto)</th>
                <th>Currency</th>
                <th>USD Value</th>
                <th>Fee</th>
                <th>Net Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.uniqueId}
                  className={`status-${payment.status}`}
                >
                  <td>
                    {new Date(
                      payment.paidAt
                    ).toLocaleDateString()}
                  </td>
                  <td>{payment.amountCrypto.toFixed(2)}</td>
                  <td>{payment.currency}</td>
                  <td>${payment.amountUsd.toFixed(2)}</td>
                  <td>${payment.platformFee.toFixed(2)}</td>
                  <td>${payment.netAmount.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${payment.status}`}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() =>
                setPage(Math.min(totalPages - 1, page + 1))
              }
              disabled={page === totalPages - 1}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

### 5. Dashboard Statistics

**`components/DashboardStats.tsx`**

```typescript
import React, { useState, useEffect } from 'react'
import fiberPaymentService from '../services/fiberPaymentService'

export const DashboardStats: React.FC<{
  businessId: string
}> = ({ businessId }) => {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const result = await fiberPaymentService.getStats('30d')
      setStats(result)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return <div className="loading">Loading statistics...</div>
  }

  return (
    <div className="dashboard-stats">
      <h2>Settlement Statistics (Last 30 Days)</h2>

      <div className="stats-grid">
        <StatCard
          title="Total Received"
          value={`$${stats.totals.totalReceivedUsdt.toFixed(2)}`}
          subtitle={`${stats.totals.paymentCount} payments`}
        />

        <StatCard
          title="Total Fees"
          value={`$${stats.totals.totalFeesPaid.toFixed(2)}`}
          subtitle={`${(
            stats.totals.averageFee * 100
          ).toFixed(2)}% avg`}
        />

        <StatCard
          title="CKB Received"
          value={`${stats.totals.totalReceivedCkb.toFixed(0)} CKB`}
          subtitle={`${stats.byCurrency.CKB?.paymentCount || 0} payments`}
        />

        <StatCard
          title="Stablecoins"
          value={`${Object.keys(stats.byCurrency).length - 1} tokens`}
          subtitle="SUDT tokens accepted"
        />
      </div>

      <div className="settlement-info">
        <p>
          Last Settlement:{' '}
          {stats.lastSettlementAt
            ? new Date(stats.lastSettlementAt).toLocaleString()
            : 'Never'}
        </p>
        <p>
          Next Settlement:{' '}
          {stats.nextSettlementAt
            ? new Date(stats.nextSettlementAt).toLocaleString()
            : 'Not scheduled'}
        </p>
      </div>
    </div>
  )
}

const StatCard: React.FC<{
  title: string
  value: string
  subtitle: string
}> = ({ title, value, subtitle }) => (
  <div className="stat-card">
    <h4>{title}</h4>
    <div className="stat-value">{value}</div>
    <div className="stat-subtitle">{subtitle}</div>
  </div>
)
```

---

## Real-time Updates

### SSE Connection Hook

**`hooks/usePaymentStream.ts`**

```typescript
import { useEffect, useCallback } from 'react'

export const usePaymentStream = (
  businessId: string,
  onPaymentReceived: (payment: any) => void,
  onSettlementCompleted?: (settlement: any) => void
) => {
  const setupStream = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    const eventSource = new EventSource(
      `/api/payments/stream?businessId=${businessId}&token=${token}`
    )

    eventSource.addEventListener(
      'payment.completed',
      (event) => {
        const payment = JSON.parse(event.data)
        onPaymentReceived(payment)
      }
    )

    eventSource.addEventListener(
      'settlement.completed',
      (event) => {
        const settlement = JSON.parse(event.data)
        onSettlementCompleted?.(settlement)
      }
    )

    eventSource.addEventListener('error', () => {
      eventSource.close()
      // Attempt reconnection after 5 seconds
      setTimeout(setupStream, 5000)
    })

    return () => eventSource.close()
  }, [businessId, onPaymentReceived, onSettlementCompleted])

  useEffect(() => {
    return setupStream()
  }, [setupStream])
}
```

---

## Error Handling

**`utils/errorHandler.ts`**

```typescript
import { AxiosError } from 'axios'

export interface ApiError {
  error: string
  code: string
  message: string
  details?: Record<string, any>
}

export const handleApiError = (error: any): ApiError => {
  const axiosError = error as AxiosError<ApiError>

  if (axiosError.response?.data) {
    return axiosError.response.data
  }

  if (axiosError.code === 'ECONNABORTED') {
    return {
      error: 'TIMEOUT',
      code: 'NET_001',
      message: 'Request timeout. Please try again.',
    }
  }

  if (!window.navigator.onLine) {
    return {
      error: 'OFFLINE',
      code: 'NET_002',
      message: 'No internet connection',
    }
  }

  return {
    error: 'UNKNOWN_ERROR',
    code: 'ERR_XXX',
    message: 'An unexpected error occurred',
  }
}

export const getErrorMessage = (error: any): string => {
  const apiError = handleApiError(error)

  const messages: Record<string, string> = {
    AUTH_001: 'Please log in again',
    FBS_001: 'Invalid Fiber channel format',
    FBS_003: 'Please enable Fiber first',
    PI_001: 'Business has not enabled Fiber',
    PI_002: 'Amount must be between $0.01 and $999,999.99',
    FBR_001: 'Cannot connect to Fiber node',
    SUDT_001: 'Invalid SUDT token configuration',
  }

  return messages[apiError.code] || apiError.message
}
```

---

## Testing

**`__tests__/fiberPayment.test.ts`**

```typescript
import fiberPaymentService from '../services/fiberPaymentService'

describe('FiberPaymentService', () => {
  beforeEach(() => {
    fiberPaymentService.setToken('test_token')
  })

  test('should create CKB payment intent', async () => {
    const result = await fiberPaymentService.createPaymentIntent({
      businessId: 'bus_123',
      fiatAmount: 100,
      fiatCurrency: 'USD',
      cryptoNetworkId: 'fiber-testnet',
      cryptoCurrency: 'CKB',
    })

    expect(result.uniqueId).toBeDefined()
    expect(result.walletAddress).toBeDefined()
    expect(result.qrCode).toBeDefined()
    expect(result.amountCrypto).toBeGreaterThan(0)
  })

  test('should handle API errors gracefully', async () => {
    try {
      await fiberPaymentService.createPaymentIntent({
        businessId: 'invalid',
        fiatAmount: -100, // Invalid
        fiatCurrency: 'USD',
        cryptoNetworkId: 'fiber-testnet',
        cryptoCurrency: 'CKB',
      })
    } catch (error: any) {
      expect(error.response?.status).toBe(422)
    }
  })
})
```

---

## Deployment Checklist

- [ ] Set `REACT_APP_API_URL` to production API
- [ ] Enable CORS for production domain
- [ ] Add SSL/TLS certificates
- [ ] Configure error reporting (Sentry, etc)
- [ ] Set up monitoring and alerts
- [ ] Test all endpoints in production
- [ ] Configure environment variables
- [ ] Enable rate limiting
- [ ] Set up backup procedures

---

**Documentation Complete!** Send these files to your frontend team:

1. `FIBER_API_DOCUMENTATION.md` - Complete API reference
2. `FIBER_API_QUICK_REFERENCE.md` - Quick reference guide
3. `FIBER_API_POSTMAN_COLLECTION.json` - Postman collection
4. `FIBER_FRONTEND_INTEGRATION_GUIDE.md` - This file

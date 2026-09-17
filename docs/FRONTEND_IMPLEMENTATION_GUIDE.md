# Frontend Implementation Guide

This document describes exactly what to build or update in the frontend to match the current backend API. Each section includes the integration point, API calls, request/response shapes, and UI behavior.

---

## 1. Guest Cart (No Login Required)

### What to build

- Cart icon/cart page that works for unauthenticated users
- `guest_token` storage in `localStorage`
- Guest cart API calls that do not require auth

### Implementation

**File:** `hooks/useGuestCart.ts`

```ts
const GUEST_TOKEN_KEY = 'guest_cart_token'

export function getGuestToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(GUEST_TOKEN_KEY)
}

export function setGuestToken(token: string) {
  localStorage.setItem(GUEST_TOKEN_KEY, token)
}

export async function addToGuestCart(productId: string, quantity = 1) {
  const existingToken = getGuestToken()
  const res = await fetch('/api/cart/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      quantity,
      guest_token: existingToken || undefined,
    }),
  })
  const data = await res.json()
  if (data.result?.guest_token) setGuestToken(data.result.guest_token)
  return data
}

export async function fetchGuestCart() {
  const token = getGuestToken()
  if (!token) return { items: [], total: 0 }
  const res = await fetch(`/api/cart?guest_token=${encodeURIComponent(token)}`)
  const data = await res.json()
  return data.data || { items: [], total: 0 }
}

export async function removeGuestCartItem(itemId: string) {
  const token = getGuestToken()
  if (!token) return
  await fetch(`/api/cart/items/${itemId}?guest_token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  })
}

export async function clearGuestCart() {
  const token = getGuestToken()
  if (!token) return
  await fetch(`/api/cart?guest_token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  })
}
```

### Cart endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Add item | POST | `/api/cart/items` | No |
| View cart | GET | `/api/cart?guest_token=<token>` | No |
| Update item | PUT | `/api/cart/items/:itemId?guest_token=<token>` | No |
| Remove item | DELETE | `/api/cart/items/:itemId?guest_token=<token>` | No |
| Clear cart | DELETE | `/api/cart?guest_token=<token>` | No |

### Important

- Send `guest_token` as a **query parameter**, not in the request body
- Store the token on first add-to-cart and reuse it for all subsequent guest cart requests

---

## 2. Checkout — Order Summary & Items

### What to build

- Show order items in the checkout success/confirmation view
- Show delivery fee in both local currency and checkout currency

### Implementation

**Checkout response now includes `items`:**

```json
{
  "payment_intent_id": "intent-uuid",
  "reference_id": "ref-uuid",
  "fiat_amount": 15500,
  "fiat_currency": "NGN",
  "items_count": 2,
  "items_total": 14000,
  "delivery_fee": 1500,
  "delivery_fee_currency": "NGN",
  "delivery_fee_local": 1500,
  "delivery_fee_local_currency": "NGN",
  "discount_amount": 0,
  "assets": [ ... ],
  "items": [
    {
      "product_id": "product-uuid",
      "name": "Product A",
      "price": 7000,
      "currency": "NGN",
      "quantity": 1,
      "image": "https://res.cloudinary.com/...",
      "shop_id": "shop-uuid"
    }
  ]
}
```

### Checkout page changes

**File:** `app/checkout/page.tsx` or equivalent

```tsx
// After calling POST /api/cart/checkout
const result = await res.json()

// Render order summary
<div className="order-summary">
  <h2>Order Summary</h2>
  {result.data.items.map((item) => (
    <div key={item.product_id} className="order-item">
      <img src={item.image} alt={item.name} />
      <div>
        <h3>{item.name}</h3>
        <p>Qty: {item.quantity}</p>
        <p>Price: {item.price} {item.currency}</p>
      </div>
    </div>
  ))}

  <div className="totals">
    <p>Subtotal: {result.data.items_total} {result.data.fiat_currency}</p>
    <p>Delivery: {result.data.delivery_fee} {result.data.delivery_fee_currency}</p>
    {result.data.delivery_fee_local !== result.data.delivery_fee && (
      <p className="text-gray-500">
        (Local: {result.data.delivery_fee_local} {result.data.delivery_fee_local_currency})
      </p>
    )}
    {result.data.discount_amount > 0 && (
      <p>Discount: -{result.data.discount_amount}</p>
    )}
    <h3>Total: {result.data.fiat_amount} {result.data.fiat_currency}</h3>
  </div>
</div>
```

### Order history page changes

**File:** `app/orders/page.tsx` or equivalent

```tsx
// When displaying order detail, render items from metadata
const order = await fetch(`/api/user/shop/orders/${orderId}`, ...)
const items = order.data.items || []

{items.map((item) => (
  <div key={item.product_id}>
    <span>{item.name}</span>
    <span>Qty: {item.quantity}</span>
    <span>{item.price} {item.currency}</span>
  </div>
))}
```

---

## 3. Product Image Upload

### What to build

- Product create/edit form that supports image upload
- Image preview before upload
- Drag-and-drop or file picker for images

### Implementation

**File:** `app/dashboard/products/new/page.tsx`

```tsx
'use client'
import { useState } from 'react'

export default function NewProductPage() {
  const [form, setForm] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    stock: '',
  })
  const [files, setFiles] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const body = new FormData()
    body.append('name', form.name)
    body.append('price', form.price)
    if (form.description) body.append('description', form.description)
    if (form.category) body.append('category', form.category)
    if (form.stock) body.append('stock', form.stock)

    if (files) {
      for (const file of Array.from(files)) {
        body.append('images', file)
      }
    }

    const res = await fetch('/api/user/shop/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body,
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.message || 'Failed to create product')
      setSubmitting(false)
      return
    }

    window.location.href = '/dashboard/products'
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
      <input
        className="w-full border p-2"
        placeholder="Product name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        className="w-full border p-2"
        type="number"
        placeholder="Price"
        value={form.price}
        onChange={(e) => setForm({ ...form, price: e.target.value })}
        required
      />
      <textarea
        className="w-full border p-2"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <input
        className="w-full border p-2"
        placeholder="Category"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      />
      <input
        className="w-full border p-2"
        type="number"
        placeholder="Stock"
        value={form.stock}
        onChange={(e) => setForm({ ...form, stock: e.target.value })}
      />
      <div>
        <label className="block mb-1">Product Images (max 5)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />
      </div>
      <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded">
        {submitting ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  )
}
```

### Edit product page

Same approach — use `PUT /api/user/shop/products/:productId` with `FormData`. Files append to existing images. JSON `images` array replaces all images.

---

## 4. Wallet Dashboard

### What to build

- Per-network wallet cards instead of single balance
- SSE listener for real-time balance updates

### Implementation

**File:** `components/WalletBalanceCards.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'

export interface Wallet {
  uniqueId: string
  walletAddress: string
  balance: number
  totalDeposited: number
  totalWithdrawn: number
  status: string
  cryptoNetwork: { name: string; logo: string; networkType: string }
  currency: { symbol: string; logo: string }
}

export default function WalletBalanceCards() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/wallets', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setWallets(res.data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading wallets...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {wallets.map((wallet) => (
        <div key={wallet.uniqueId} className="border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <img src={wallet.cryptoNetwork.logo} alt="" className="w-8 h-8" />
            <div>
              <div className="font-semibold">{wallet.cryptoNetwork.name}</div>
              <div className="text-xs text-gray-500">
                {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold">
            {wallet.balance.toFixed(6)} <span className="text-sm">{wallet.currency.symbol}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Deposited: {wallet.totalDeposited.toFixed(6)} | Withdrawn: {wallet.totalWithdrawn.toFixed(6)}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### SSE balance updates

**File:** `hooks/useWalletSSE.ts`

```ts
'use client'
import { useEffect } from 'react'

export function useWalletSSE(onBalanceUpdate: (data: any) => void) {
  useEffect(() => {
    const token = getToken()
    if (!token) return

    const es = new EventSource('/api/user/stream', {
      headers: { Authorization: `Bearer ${token}` },
    })

    es.addEventListener('wallet.balance_updated', (e) => {
      const data = JSON.parse(e.data)
      onBalanceUpdate(data)
    })

    return () => es.close()
  }, [onBalanceUpdate])
}
```

---

## 5. Withdrawal Flow

### What to build

- Wallet selector dropdown
- Network-aware address validation
- OTP confirmation screen

### Implementation

**File:** `components/WithdrawalForm.tsx`

```tsx
'use client'
import { useState, useEffect } from 'react'

const ADDRESS_VALIDATION = {
  evm: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tron: /^T[a-km-zA-HJ-NP-Z1-9]{33}$/,
  ckb: /^ckb1q[1-9A-HJ-NP-Za-km-z]{39,59}$/,
}

export default function WithdrawalForm() {
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState('')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const wallet = wallets.find((w: any) => w.uniqueId === selectedWallet)
  const networkType = wallet?.cryptoNetwork?.networkType

  const validateAddress = (addr: string) => {
    if (!networkType) return false
    return ADDRESS_VALIDATION[networkType as keyof typeof ADDRESS_VALIDATION]?.test(addr) || false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateAddress(recipient)) {
      setError('Invalid recipient address for selected network')
      return
    }

    const res = await fetch('/api/user/withdrawal/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        type: 'crypto',
        user_wallet_id: selectedWallet,
        amount: parseFloat(amount),
        crypto_currency_id: wallet?.currency?.uniqueId,
        network_id: wallet?.cryptoNetwork?.id,
        recipient_address: recipient,
      }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.message || 'Failed')
    // proceed to OTP confirmation
  }

  useEffect(() => {
    fetch('/api/user/wallets', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => setWallets(res.data || []))
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
        value={selectedWallet}
        onChange={(e) => setSelectedWallet(e.target.value)}
        required
      >
        <option value="">Select wallet</option>
        {wallets.map((w: any) => (
          <option key={w.uniqueId} value={w.uniqueId}>
            {w.cryptoNetwork.name} — {w.balance.toFixed(6)} {w.currency.symbol}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder={`Recipient ${networkType || ''} address`}
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        required
      />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        max={wallet?.balance || 0}
      />

      {error && <p className="text-red-500">{error}</p>}

      <button type="submit" disabled={!selectedWallet || !amount}>
        Withdraw
      </button>
    </form>
  )
}
```

---

## 6. Order Messages

### What to build

- Messages tab on order detail page
- Message list + input field
- Read/unread indicators

### Implementation

**List messages:**

```tsx
const messages = await fetch(
  `/api/user/shop/orders/${orderId}/messages?shop_id=${shopId}`,
  { headers: { Authorization: `Bearer ${getToken()}` } }
)
const data = await messages.json()

{data.data.map((msg) => (
  <div key={msg.id} className={`message ${msg.sender_type}`}>
    <div className="font-semibold">{msg.sender_type}</div>
    <p>{msg.message}</p>
    <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString()}</span>
  </div>
))}
```

**Send message:**

```tsx
const res = await fetch(
  `/api/user/shop/orders/${orderId}/messages?shop_id=${shopId}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ message: 'Your order has been shipped.', sender_type: 'merchant' }),
  }
)
```

---

## 7. Analytics & Charts

### What to build

- Revenue chart (line or bar)
- Orders chart
- Payment link performance table

### Implementation

**Shop analytics:**

```tsx
const analytics = await fetch(
  `/api/user/shop/orders/analytics?from=2026-01-01&to=2026-12-31&group_by=day`,
  { headers: { Authorization: `Bearer ${getToken()}` } }
)
const data = await analytics.json()

// data.data.time_series is an array of { period, order_count, total_amount }
// Use period for X-axis, order_count for order bars, total_amount for revenue line
```

**Payment link analytics:**

```tsx
const linkAnalytics = await fetch(
  `/api/client/payment-links/analytics?from=2026-01-01&to=2026-12-31`,
  { headers: { Authorization: `Bearer ${getToken()}` } }
)
const data = await linkAnalytics.json()

// data.data.links is an array of { slug, usage_count, order_count, revenue }
// Show conversion rate: order_count / usage_count
```

---

## 8. Delivery Settings

### What to build

- Delivery settings form for shop owners
- Currency selector for delivery fee
- Delivery zones editor

### Implementation

**File:** `app/dashboard/settings/delivery/page.tsx`

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function DeliverySettings() {
  const [settings, setSettings] = useState({
    has_free_delivery: false,
    delivery_fee: 0,
    delivery_fee_currency: 'NGN',
    delivery_zones: {},
    discount_percentage: 0,
    discount_amount: 0,
    promo_code: '',
    free_delivery_threshold: null,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/user/shop/delivery-settings', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setSettings(res.data)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    await fetch('/api/user/shop/delivery-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(settings),
    })

    setSaving(false)
    alert('Delivery settings saved!')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Delivery Settings</h1>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.has_free_delivery}
            onChange={(e) => setSettings({ ...settings, has_free_delivery: e.target.checked })}
          />
          Free delivery
        </label>
      </div>

      {!settings.has_free_delivery && (
        <>
          <div>
            <label>Delivery Fee Amount</label>
            <input
              type="number"
              value={settings.delivery_fee}
              onChange={(e) => setSettings({ ...settings, delivery_fee: parseFloat(e.target.value) || 0 })}
              className="border p-2 w-full"
            />
          </div>

          <div>
            <label>Delivery Fee Currency</label>
            <select
              value={settings.delivery_fee_currency}
              onChange={(e) => setSettings({ ...settings, delivery_fee_currency: e.target.value })}
              className="border p-2 w-full"
            >
              <option value="NGN">NGN - Nigerian Naira</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
            <p className="text-sm text-gray-500">
              This will be automatically converted to the checkout currency.
            </p>
          </div>

          <div>
            <label>Delivery Zones (JSON)</label>
            <textarea
              value={JSON.stringify(settings.delivery_zones, null, 2)}
              onChange={(e) => {
                try {
                  const zones = JSON.parse(e.target.value)
                  setSettings({ ...settings, delivery_zones: zones })
                } catch {}
              }}
              className="border p-2 w-full h-32"
              placeholder='{"Lagos": 1500, "Abuja": 2000}'
            />
          </div>
        </>
      )}

      <div>
        <label>Discount Percentage (%)</label>
        <input
          type="number"
          value={settings.discount_percentage}
          onChange={(e) => setSettings({ ...settings, discount_percentage: parseFloat(e.target.value) || 0 })}
          className="border p-2 w-full"
        />
      </div>

      <div>
        <label>Discount Amount (fixed)</label>
        <input
          type="number"
          value={settings.discount_amount}
          onChange={(e) => setSettings({ ...settings, discount_amount: parseFloat(e.target.value) || 0 })}
          className="border p-2 w-full"
        />
      </div>

      <div>
        <label>Promo Code</label>
        <input
          type="text"
          value={settings.promo_code}
          onChange={(e) => setSettings({ ...settings, promo_code: e.target.value })}
          className="border p-2 w-full"
        />
      </div>

      <div>
        <label>Free Delivery Threshold</label>
        <input
          type="number"
          value={settings.free_delivery_threshold || ''}
          onChange={(e) => setSettings({ ...settings, free_delivery_threshold: e.target.value ? parseFloat(e.target.value) : null })}
          className="border p-2 w-full"
        />
      </div>

      <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">
        {saving ? 'Saving...' : 'Save Delivery Settings'}
      </button>
    </form>
  )
}
```

---

## 9. SSE Events

### What to build

- SSE connection on dashboard/wallet page
- Handle `wallet.balance_updated`, `transaction.confirmed`, `withdrawal.updated`

### Implementation

**File:** `hooks/useWalletSSE.ts`

```ts
'use client'
import { useEffect } from 'react'

export function useWalletSSE() {
  useEffect(() => {
    const token = getToken()
    if (!token) return

    const es = new EventSource('/api/user/stream', {
      headers: { Authorization: `Bearer ${token}` },
    })

    es.addEventListener('wallet.balance_updated', (e) => {
      const data = JSON.parse(e.data)
      // Update wallet balances in state
      console.log('Balance updated:', data)
    })

    es.addEventListener('transaction.confirmed', (e) => {
      const data = JSON.parse(e.data)
      // Show success notification, refresh transaction list
      console.log('Transaction confirmed:', data)
    })

    es.addEventListener('withdrawal.updated', (e) => {
      const data = JSON.parse(e.data)
      // Update withdrawal status in history
      console.log('Withdrawal updated:', data)
    })

    return () => es.close()
  }, [])
}
```

---

## 10. Address Validation

### What to build

- Network-aware address validation on withdrawal form
- Show validation error before submitting

### Implementation

```ts
const ADDRESS_REGEX = {
  evm: /^0x[a-fA-F0-9]{40}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  eth: /^0x[a-fA-F0-9]{40}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  ckb: /^ckb1q[1-9A-HJ-NP-Za-km-z]{39,59}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tron: /^T[a-km-zA-HJ-NP-Z1-9]{33}$/,
}

function validateAddress(address: string, networkType: string): boolean {
  const regex = ADDRESS_REGEX[networkType as keyof typeof ADDRESS_REGEX]
  return regex ? regex.test(address) : false
}
```

---

## 11. Available Assets Filtering

### What to build

- Group assets by network type
- Show network logo next to each asset

### Implementation

```tsx
const assets = await fetch('/api/available-assets', {
  headers: { Authorization: `Bearer ${getToken()}` },
}).then((r) => r.json())

const networks = Array.from(new Set(assets.data.map((a: any) => a.network.networkType)))

// Group by network
const grouped = assets.data.reduce((acc: any, asset: any) => {
  const key = asset.network.networkType
  if (!acc[key]) acc[key] = []
  acc[key].push(asset)
  return acc
}, {})

// Render
{Object.entries(grouped).map(([networkType, networkAssets]: [string, any]) => (
  <div key={networkType}>
    <h3>{networkType.toUpperCase()}</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {(networkAssets as any[]).map((asset) => (
        <div key={asset.currency_id} className="border rounded-lg p-3">
          <img src={asset.crypto.logo} alt="" className="w-8 h-8 mb-2" />
          <div className="font-semibold">{asset.crypto.symbol}</div>
          <div className="text-xs text-gray-500">{asset.network.name}</div>
        </div>
      ))}
    </div>
  </div>
))}
```

---

## 12. Product Update with Images

### What to build

- Edit product page with image upload
- Show existing images with delete option
- Upload new images via multipart

### Implementation

**File:** `app/dashboard/products/[id]/page.tsx`

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function EditProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState(null)
  const [files, setFiles] = useState<FileList | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/user/shop/products/${params.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((r) => r.json()).then((res) => setProduct(res.data))
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const body = new FormData()
    body.append('name', product.name)
    body.append('price', product.price.toString())
    if (product.description) body.append('description', product.description)
    if (product.category) body.append('category', product.category)

    if (files) {
      for (const file of Array.from(files)) {
        body.append('images', file)
      }
    }

    const res = await fetch(`/api/user/shop/products/${params.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body,
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.message || 'Failed to update product')
      setSaving(false)
      return
    }

    window.location.href = '/dashboard/products'
  }

  if (!product) return <div>Loading...</div>

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
      <input
        className="w-full border p-2"
        value={product.name}
        onChange={(e) => setProduct({ ...product, name: e.target.value })}
      />
      <input
        className="w-full border p-2"
        type="number"
        value={product.price}
        onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })}
      />
      <textarea
        className="w-full border p-2"
        value={product.description || ''}
        onChange={(e) => setProduct({ ...product, description: e.target.value })}
      />

      <div>
        <label>Current Images</label>
        <div className="flex gap-2 mt-2">
          {(product.images || []).map((img: any) => (
            <div key={img.publicId} className="relative">
              <img src={img.url} alt="" className="w-20 h-20 object-cover rounded" />
              <button
                type="button"
                onClick={async () => {
                  await fetch(
                    `/api/user/shop/products/${params.id}/images/${encodeURIComponent(img.publicId)}`,
                    { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }
                  )
                  setProduct({
                    ...product,
                    images: product.images.filter((i: any) => i.publicId !== img.publicId),
                  })
                }}
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label>Add Images</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />
      </div>

      <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">
        {saving ? 'Saving...' : 'Update Product'}
      </button>
    </form>
  )
}
```

---

## 13. Error Handling

### What to build

- Consistent error display across all API calls
- Redirect to login on 401
- Show toast for 403/404/500

### Implementation

```ts
async function handleApiCall(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    return
  }

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 403) {
      showToast("You don't have permission to access this resource.")
    } else if (res.status === 404) {
      showToast('Resource not found.')
    } else if (res.status === 410) {
      showToast('This resource is no longer available.')
    } else {
      showToast(data.message || 'Something went wrong. Please try again.')
    }
    return
  }

  return data
}
```

---

## 14. Quick Reference — All New/Changed Endpoints

| Feature | Endpoint | Method | Auth | New/Changed |
|---------|----------|--------|------|-------------|
| **Guest Cart** | | | | |
| Add to cart | `/api/cart/items` | POST | No | New |
| View cart | `/api/cart` | GET | No | New |
| Update item | `/api/cart/items/:itemId` | PUT | No | New |
| Remove item | `/api/cart/items/:itemId` | DELETE | No | New |
| Clear cart | `/api/cart` | DELETE | No | New |
| **Checkout** | | | | |
| Auth checkout | `/api/user/cart/checkout` | POST | Yes | Changed — now returns `items` |
| Guest checkout | `/api/cart/checkout` | POST | No | Changed — now returns `items` |
| **Products** | | | | |
| Create product | `/api/user/shop/products` | POST | Yes | Changed — accepts `images` |
| Update product | `/api/user/shop/products/:id` | PUT | Yes | Changed — accepts `images` |
| Upload images | `/api/user/shop/products/:id/images` | POST | Yes | Unchanged |
| Delete image | `/api/user/shop/products/:id/images/:publicId` | DELETE | Yes | Unchanged |
| **Wallets** | | | | |
| List wallets | `/api/user/wallets` | GET | Yes | Unchanged |
| Dashboard stats | `/api/dashboard/stats` | GET | Yes | Unchanged |
| **Withdrawals** | | | | |
| Initiate | `/api/user/withdrawal/initiate` | POST | Yes | Changed — requires `user_wallet_id` |
| Confirm | `/api/user/withdrawal/confirm` | POST | Yes | Unchanged |
| History | `/api/user/withdrawals/history` | GET | Yes | Unchanged |
| **Orders** | | | | |
| List orders | `/api/user/shop/orders` | GET | Yes | Unchanged |
| Order detail | `/api/user/shop/orders/:id` | GET | Yes | Unchanged |
| Update status | `/PATCH /api/user/shop/orders/:id/status` | PATCH | Yes | Unchanged |
| Order messages | `/api/user/shop/orders/:orderId/messages` | GET | Yes | New |
| Send message | `/api/user/shop/orders/:orderId/messages` | POST | Yes | New |
| Mark read | `/PATCH /api/user/shop/orders/:orderId/messages/read` | PATCH | Yes | New |
| Analytics | `/api/user/shop/orders/analytics` | GET | Yes | Changed — added `time_series`, `unique_customers`, `link_clicks` |
| **Payment Links** | | | | |
| Link analytics | `/api/client/payment-links/analytics` | GET | Yes | New |
| **Delivery** | | | | |
| Get settings | `/api/user/shop/delivery-settings` | GET | Yes | Changed — returns `delivery_fee_currency`, `delivery_fee_usd` |
| Update settings | `/api/user/shop/delivery-settings` | PUT | Yes | Changed — accepts `delivery_fee_currency` |
| **SSE** | | | | |
| Live stream | `/api/user/stream` | GET | Yes | Unchanged |

---

## 15. Priority Implementation Order

1. **Guest cart** — required for checkout to work for unauthenticated users
2. **Checkout order summary** — show `items` array in checkout response
3. **Wallet dashboard** — per-network wallet cards + SSE
4. **Withdrawal form** — wallet selector + address validation
5. **Delivery settings** — shop owner form + checkout display
6. **Product image upload** — create/edit with images
7. **Order messages** — messages tab on order detail
8. **Analytics charts** — revenue/orders charts + payment link analytics

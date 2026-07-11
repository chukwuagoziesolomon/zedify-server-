/**
 * Shop Builder API Test Script
 * Run: node scripts/test-shop-flow.js
 *
 * Tests: signup → login → create shop → get shop
 * Prints raw responses so you can confirm shop_url and preview fields.
 */

const BASE = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3335}`
const ts = Date.now()
const EMAIL = `shoptest${ts}@test.com`
const PASS = 'Password123!'
const PHONE = `070${String(ts).slice(-8)}`
const SUBDOMAIN = `testshop${ts}`

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { status: res.status, body: json }
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return { status: res.status, body: json }
}

function print(label, data) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${label}`)
  console.log('='.repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

;(async () => {
  console.log(`\nBase URL : ${BASE}`)
  console.log(`Email    : ${EMAIL}`)
  console.log(`Phone    : ${PHONE}`)
  console.log(`Subdomain: ${SUBDOMAIN}`)

  // ── 1. Sign up ──────────────────────────────────────────────────────────────
  const signup = await post('/api/user/account/signup', {
    first_name: 'Test',
    last_name: 'User',
    business_name: 'Test Business',
    country: 'NG',
    email: EMAIL,
    password: PASS,
    password_confirmation: PASS,
    phone: PHONE,
    business_type: 'starter',
    bvn: '12345678901',
  })
  print('STEP 1 — SIGN UP', signup)
  if (signup.status !== 200 && signup.status !== 201) {
    console.error('\n❌ Signup failed — aborting')
    process.exit(1)
  }

  // ── 2. Login ────────────────────────────────────────────────────────────────
  const login = await post('/api/user/account/login', { email: EMAIL, password: PASS })
  print('STEP 2 — LOGIN', login)
  const token = login.body?.data?.token || login.body?.result?.token
  if (!token) {
    console.error('\n❌ Login failed — no token — aborting')
    process.exit(1)
  }
  console.log(`\n✅ Token: ${token.slice(0, 30)}...`)

  // ── 3. Create shop ──────────────────────────────────────────────────────────
  const create = await post(
    '/api/user/shop',
    {
      business_name: 'My Test Shop',
      subdomain: SUBDOMAIN,
      description: 'Test shop for URL verification',
      currency: 'NGN',
      shop_type: 'default',
    },
    token
  )
  print('STEP 3 — CREATE SHOP', create)

  // ── 4. GET shop ─────────────────────────────────────────────────────────────
  const getShop = await get('/api/user/shop', token)
  print('STEP 4 — GET SHOP', getShop)

  // ── 5. Public storefront (no auth) ─────────────────────────────────────────
  print('STEP 5 — PUBLIC STOREFRONT (no auth)', await (async () => {
    const res = await fetch(`${BASE}/api/storefront/${SUBDOMAIN}`)
    return { status: res.status, body: await res.json() }
  })())
  // data is under result, not data
  const shop = getShop.body?.result || getShop.body?.data
  console.log('\n' + '='.repeat(60))
  console.log('  SUMMARY — KEY FIELDS')
  console.log('='.repeat(60))
  if (shop) {
    console.log(`shop_url        : ${shop.shop_url ?? '❌ NULL'}`)
    console.log(`storefront_url  : ${shop.storefront_url ?? '❌ NULL'}`)
    console.log(`checkout_url    : ${shop.checkout_url ?? '❌ NULL'}`)
    console.log(`preview.url     : ${shop.preview?.url ?? '❌ NULL'}`)
    console.log(`preview.is_live : ${shop.preview?.is_live ?? '❌ NULL'}`)
    console.log(`status          : ${shop.status}`)
    console.log(`shop_type       : ${shop.shop_type}`)
  } else {
    console.log('❌ No shop data in response')
  }
})()

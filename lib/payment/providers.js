// Provider payment — pluggable. Urutan via env PAYMENT_PROVIDER.
//   mock   : tanpa API key, untuk testing (selalu return QR dummy)
//   tripay : butuh TRIPAY_API_KEY + TRIPAY_MERCHANT
//   xendit : butuh XENDIT_API_KEY

function ref() {
  return 'PAY-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

// ---- mock (testing, tanpa key) ----
async function viaMock(amount, method, orderId) {
  const reference = ref()
  return {
    ok: true, provider: 'mock',
    reference,
    amount, method, order_id: orderId,
    status: 'pending',
    // QR dummy — di production diganti QR asli dari provider
    qr_url: 'https://api.servercloud.my.id/api/payment/mock-qr/' + reference,
    qr_string: 'MOCK-QRIS-' + reference,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    note: 'MODE TEST — bukan QR asli. Aktifkan tripay/xendit untuk QR beneran.',
  }
}

// ---- tripay ----
async function viaTripay(amount, method, orderId) {
  const key = process.env.TRIPAY_API_KEY
  const merchant = process.env.TRIPAY_MERCHANT
  if (!key || !merchant) return { ok: false, code: 'NO_KEY', error: 'TRIPAY_API_KEY / TRIPAY_MERCHANT belum diset.' }
  const payload = {
    method: method || 'QRIS',
    merchant_ref: orderId || ref(),
    amount: Number(amount),
    customer_name: 'Habibi Store',
    order_items: [{ name: 'Pembayaran Habibi Store', price: Number(amount), quantity: 1 }],
    expired_time: Math.floor(Date.now() / 1000) + 1800,
    signature: '', // dihitung di bawah
  }
  const crypto = await import('crypto')
  payload.signature = crypto.createHmac('sha256', key)
    .update(merchant + payload.merchant_ref + payload.amount).digest('hex')
  const res = await fetch('https://tripay.co.id/api/transaction/create', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, merchant_code: merchant }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await res.json().catch(() => null)
  if (!j?.success) return { ok: false, code: 'TRIPAY_ERROR', error: j?.message || 'Tripay HTTP ' + res.status }
  const d = j.data
  return {
    ok: true, provider: 'tripay',
    reference: d.reference, amount: d.amount, method: d.payment_method,
    order_id: orderId, status: 'pending',
    qr_url: d.qr_url || null, qr_string: d.qr_string || null,
    pay_url: d.checkout_url || null,
    expires_at: new Date(d.expired_time * 1000).toISOString(),
  }
}

// ---- xendit ----
async function viaXendit(amount, method, orderId) {
  const key = process.env.XENDIT_API_KEY
  if (!key) return { ok: false, code: 'NO_KEY', error: 'XENDIT_API_KEY belum diset.' }
  const reference = orderId || ref()
  const auth = Buffer.from(key + ':').toString('base64')
  const res = await fetch('https://api.xendit.co/qr_codes', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference_id: reference,
      type: 'DYNAMIC',
      currency: 'IDR',
      amount: Number(amount),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await res.json().catch(() => null)
  if (!j?.id) return { ok: false, code: 'XENDIT_ERROR', error: j?.message || 'Xendit HTTP ' + res.status }
  return {
    ok: true, provider: 'xendit',
    reference: j.reference_id, xendit_id: j.id,
    amount: j.amount, method: 'QRIS', order_id: orderId,
    status: 'pending',
    qr_string: j.qr_string || null,
    expires_at: j.expires_at,
  }
}

const PROVIDERS = { mock: viaMock, tripay: viaTripay, xendit: viaXendit }

export async function createPayment(amount, method, orderId) {
  amount = Number(amount)
  if (!(amount > 0)) return { ok: false, code: 'INVALID_AMOUNT', error: 'Nominal tidak valid.' }
  const order = (process.env.PAYMENT_PROVIDER || 'mock,tripay,xendit').split(',').map(s => s.trim()).filter(Boolean)
  const errors = []
  for (const name of order) {
    const fn = PROVIDERS[name]
    if (!fn) continue
    try {
      const r = await fn(amount, method, orderId)
      if (r.ok) return r
      errors.push(name + ': ' + r.error)
    } catch (e) { errors.push(name + ': ' + e.message) }
  }
  return { ok: false, code: 'ALL_FAILED', error: 'Semua provider payment gagal.', details: errors }
}

export function activeProviders() {
  const order = (process.env.PAYMENT_PROVIDER || 'mock,tripay,xendit').split(',').map(s => s.trim())
  return {
    order,
    configured: {
      mock: true,
      tripay: !!(process.env.TRIPAY_API_KEY && process.env.TRIPAY_MERCHANT),
      xendit: !!process.env.XENDIT_API_KEY,
    },
  }
}

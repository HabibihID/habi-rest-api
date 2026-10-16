// ongkir — Cek ongkir & lacak paket via Komerce/RajaOngkir API.
// API key via env KOMERCE_KEY.

const BASE = 'https://rajaongkir.komerce.id/api/v1'
const key = () => (process.env.KOMERCE_KEY || '').trim()

async function api(path, { method = 'GET', params = {}, form = null } = {}) {
  const k = key()
  if (!k) throw new Error('KOMERCE_KEY belum diisi di .env VPS.')
  let url = `${BASE}${path}`
  if (Object.keys(params).length) url += '?' + new URLSearchParams(params).toString()
  const opts = { method, headers: { 'key': k } }
  if (form) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    opts.body = new URLSearchParams(form).toString()
  }
  const r = await fetch(url, opts)
  const j = await r.json().catch(() => null)
  if (!j || j.meta?.status !== 'success') {
    throw new Error(j?.meta?.message || `Komerce HTTP ${r.status}`)
  }
  return j.data
}

export async function searchDestination(q, limit = 5) {
  return api('/destination/domestic-destination', { params: { search: q, limit: String(limit) } })
}

export async function calculateCost(originId, destId, weight = 1000, courier = '') {
  const form = { origin: String(originId), destination: String(destId), weight: String(weight) }
  if (courier) form.courier = courier
  return api('/calculate/domestic-cost', { method: 'POST', form })
}

export async function trackWaybill(awb, courier) {
  return api('/track/waybill', { method: 'POST', form: { awb, courier } })
}

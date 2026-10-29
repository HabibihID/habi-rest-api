// ongkir — Cek ongkir & lacak paket via Komerce/RajaOngkir API.
// API key via env KOMERCE_KEY.

import { httpGet, httpPost } from '../http.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

const BASE = 'https://rajaongkir.komerce.id/api/v1'
const PROVIDER = 'komerce'
const key = () => (process.env.KOMERCE_KEY || '').trim()

// Panggil API Komerce. Melempar Error dengan pesan dari provider bila gagal.
async function api(path, { method = 'GET', params = {}, form = null } = {}) {
  const k = key()
  if (!k) throw new Error('KOMERCE_KEY belum diisi di .env VPS.')
  await throttle(PROVIDER, 1000)
  const headers = { 'key': k }
  let data
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    data = await httpPost(`${BASE}${path}`, new URLSearchParams(form || {}).toString(), {
      provider: PROVIDER, headers,
    })
  } else {
    let url = `${BASE}${path}`
    if (Object.keys(params).length) url += '?' + new URLSearchParams(params).toString()
    data = await httpGet(url, { provider: PROVIDER, headers })
  }
  if (!data || data.meta?.status !== 'success') {
    throw new Error(data?.meta?.message || `Komerce: respons tidak valid`)
  }
  return data.data
}

// Cari destinasi — data statis, cache 60 menit
export async function searchDestination(q, limit = 5) {
  const query = String(q || '').trim().toLowerCase()
  return cached(`ongkir:dest:${query}:${limit}`, 60 * 60 * 1000, () =>
    api('/destination/domestic-destination', { params: { search: q, limit: String(limit) } })
  )
}

// Hitung ongkos kirim — tarif jarang berubah, cache 30 menit
export async function calculateCost(originId, destId, weight = 1000, courier = '') {
  const form = { origin: String(originId), destination: String(destId), weight: String(weight) }
  if (courier) form.courier = courier
  return cached(`ongkir:cost:${form.origin}:${form.destination}:${form.weight}:${courier}`, 30 * 60 * 1000, () =>
    api('/calculate/domestic-cost', { method: 'POST', form })
  )
}

// Lacak paket — data real-time, JANGAN di-cache
export async function trackWaybill(awb, courier) {
  return api('/track/waybill', { method: 'POST', form: { awb, courier } })
}

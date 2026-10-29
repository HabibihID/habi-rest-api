// Kurs — kurs mata uang via Frankfurter API (gratis, tanpa key, tanpa daftar).
// Rate dari bank sentral Eropa, update harian.
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/kurs?from=USD&to=IDR            -> { status:true, from, to, rate }
// GET /api/kurs?from=USD&to=IDR&amount=100 -> { ..., amount, hasil }

import { httpGet } from '../http.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'frankfurter'

// Ambil rate mentah dari Frankfurter. Rate update harian → cache 60 menit.
// Hanya rate yang di-cache; amount diformat lokal agar tiap request tetap akurat.
async function fetchRate(from, to) {
  return cached(`kurs:${from}:${to}`, 60 * 60 * 1000, async () => {
    await throttle(PROVIDER, 1000)
    const j = await httpGet(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      provider: PROVIDER,
      headers: { 'User-Agent': 'HABI-REST-API/1.0' },
    })
    const rate = j?.rates?.[to]
    if (!rate) throw new Error(`Kurs ${from}→${to} tidak tersedia.`)
    return { rate, tanggal: j.date || null }
  })
}

export async function kurs(from, to, amount) {
  from = String(from || 'USD').trim().toUpperCase()
  to = String(to || 'IDR').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    throw new Error('Kode mata uang harus 3 huruf. Contoh: USD, IDR, EUR, JPY.')
  }
  const amt = amount ? Number(amount) : 1
  if (isNaN(amt) || amt <= 0) throw new Error('Jumlah harus angka positif.')

  const { rate, tanggal } = await fetchRate(from, to)

  const fmt = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  return {
    from, to,
    rate: fmt(rate),
    tanggal,
    amount: fmt(amt),
    hasil: fmt(amt * rate),
  }
}

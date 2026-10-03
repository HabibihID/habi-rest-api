// Kurs — kurs mata uang via Frankfurter API (gratis, tanpa key, tanpa daftar).
// Rate dari bank sentral Eropa, update harian.
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/kurs?from=USD&to=IDR            -> { status:true, from, to, rate }
// GET /api/kurs?from=USD&to=IDR&amount=100 -> { ..., amount, hasil }

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

const UA = { 'User-Agent': 'HABI-REST-API/1.0' }

export async function kurs(from, to, amount) {
  from = String(from || 'USD').trim().toUpperCase()
  to = String(to || 'IDR').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    throw new Error('Kode mata uang harus 3 huruf. Contoh: USD, IDR, EUR, JPY.')
  }
  const amt = amount ? Number(amount) : 1
  if (isNaN(amt) || amt <= 0) throw new Error('Jumlah harus angka positif.')

  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
  const r = await fetchTimeout(url, { headers: UA })
  if (!r.ok) throw new Error(`Frankfurter HTTP ${r.status}`)
  const j = await r.json()
  const rate = j?.rates?.[to]
  if (!rate) throw new Error(`Kurs ${from}→${to} tidak tersedia.`)

  const fmt = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  return {
    from, to,
    rate: fmt(rate),
    tanggal: j.date || null,
    amount: fmt(amt),
    hasil: fmt(amt * rate),
  }
}

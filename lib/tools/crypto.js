// Crypto — harga crypto real-time via CoinGecko free API (tanpa key).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/crypto?coin=bitcoin -> { status:true, nama, simbol, harga_usd, harga_idr, perubahan_24j }

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

const UA = { 'User-Agent': 'HABI-REST-API/1.0' }

// alias umum -> id coingecko
const ALIAS = {
  btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana',
  xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', trx: 'tron',
  dot: 'polkadot', matic: 'polygon', ltc: 'litecoin', shib: 'shiba-inu',
  avax: 'avalanche-2', link: 'chainlink', atom: 'cosmos', uni: 'uniswap',
  usdt: 'tether', usdc: 'usd-coin', pepe: 'pepe', ton: 'the-open-network',
}

const fmtIDR = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')
const fmtUSD = (n) => '$' + (n >= 1
  ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  : n.toLocaleString('en-US', { maximumFractionDigits: 6 }))

export async function cryptoPrice(input) {
  const raw = String(input || '').trim().toLowerCase()
  if (!raw) throw new Error('Parameter ?coin= wajib diisi. Contoh: ?coin=bitcoin')
  const id = ALIAS[raw] || raw.replace(/\s+/g, '-')

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&price_change_percentage=24h`
  const r = await fetchTimeout(url, { headers: UA })
  if (r.status === 429) throw new Error('Rate limit CoinGecko, coba lagi sebentar.')
  if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`)
  const arr = await r.json()
  const c = arr?.[0]
  if (!c) throw new Error(`Coin "${raw}" tidak ditemukan. Coba: bitcoin, ethereum, solana, doge...`)

  // konversi ke IDR via frankfurter (gratis)
  let idrRate = 16000
  try {
    const fx = await fetchTimeout('https://api.frankfurter.app/latest?from=USD&to=IDR', { headers: UA }, 15000)
    const fj = await fx.json()
    if (fj?.rates?.IDR) idrRate = fj.rates.IDR
  } catch {}

  const hargaUsd = c.current_price
  return {
    nama: c.name,
    simbol: String(c.symbol || '').toUpperCase(),
    harga_usd: fmtUSD(hargaUsd),
    harga_idr: fmtIDR(hargaUsd * idrRate),
    perubahan_24j: `${c.price_change_percentage_24h >= 0 ? '🟢 +' : '🔴 '}${Number(c.price_change_percentage_24h || 0).toFixed(2)}%`,
    market_cap_usd: fmtUSD(c.market_cap || 0),
  }
}

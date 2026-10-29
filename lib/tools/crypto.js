// Crypto — harga crypto real-time via CoinGecko free API (tanpa key).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/crypto?coin=bitcoin -> { status:true, nama, simbol, harga_usd, harga_idr, perubahan_24j }

import { httpGet } from '../http.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

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

// Kurs USD→IDR untuk konversi. Rate update harian → cache 60 menit.
async function usdToIdr() {
  return cached('crypto:usdidr', 60 * 60 * 1000, async () => {
    await throttle('frankfurter', 1000)
    try {
      const j = await httpGet('https://api.frankfurter.app/latest?from=USD&to=IDR', {
        provider: 'frankfurter', headers: UA,
      })
      if (j?.rates?.IDR) return j.rates.IDR
    } catch { /* pakai fallback di bawah */ }
    return 16000
  })
}

export async function cryptoPrice(input) {
  const raw = String(input || '').trim().toLowerCase()
  if (!raw) throw new Error('Parameter ?coin= wajib diisi. Contoh: ?coin=bitcoin')
  const id = ALIAS[raw] || raw.replace(/\s+/g, '-')

  // Harga berubah cepat, tapi cache 5 menit cukup untuk bot & hemat kuota CoinGecko
  const c = await cached(`crypto:${id}`, 5 * 60 * 1000, async () => {
    // CoinGecko free tier ketat (10-30 req/menit) → jeda 2 detik antar request
    await throttle('coingecko', 2000)
    let arr
    try {
      arr = await httpGet(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&price_change_percentage=24h`,
        { provider: 'coingecko', headers: UA }
      )
    } catch (err) {
      if (err?.status === 429) throw new Error('Rate limit CoinGecko, coba lagi sebentar.')
      throw err
    }
    const coin = arr?.[0]
    if (!coin) throw new Error(`Coin "${raw}" tidak ditemukan. Coba: bitcoin, ethereum, solana, doge...`)
    return coin
  })

  const idrRate = await usdToIdr()
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

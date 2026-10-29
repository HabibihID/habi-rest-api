/**
 * lib/ratelimit.js — Per-provider rate limiter untuk HABI REST API
 *
 * Prinsip anti-blokir IP: pola request yang wajar.
 * Setiap provider eksternal punya jeda minimum antar request (default 1 detik)
 * agar tidak terlihat seperti scraping agresif / abuse.
 *
 * - Keyed per provider (mis. 'tiktok', 'youtube', 'komerce')
 * - Menjamin jeda minimum antar request ke provider yang sama
 * - Non-blocking antar provider yang berbeda (hanya antre per provider)
 * - Jitter kecil agar pola tidak terlalu mekanis
 *
 * Penggunaan:
 *   import { throttle } from '../ratelimit.js'
 *   await throttle('tiktok')          // default 1000ms antar request
 *   await throttle('komerce', 2000)   // 2 detik antar request
 *   const data = await httpGet(url, { provider: 'tiktok' })
 */

const lastHit = new Map() // provider -> timestamp request terakhir
const queues = new Map()  // provider -> promise antrian

const DEFAULT_MIN_INTERVAL = 1000

function jitter(ms) {
  // ±20% jitter agar pola request terlihat natural
  return ms * (0.8 + Math.random() * 0.4)
}

async function waitForSlot(provider, minInterval) {
  const now = Date.now()
  const last = lastHit.get(provider) || 0
  const wait = Math.max(0, (last + jitter(minInterval)) - now)
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait))
  }
  lastHit.set(provider, Date.now())
}

/**
 * Tunggu hingga slot tersedia untuk provider ini, lalu lanjut.
 * Request ke provider yang sama otomatis diantrekan berurutan.
 */
export function throttle(provider, minIntervalMs = DEFAULT_MIN_INTERVAL) {
  const prev = queues.get(provider) || Promise.resolve()
  const next = prev.then(() => waitForSlot(provider, minIntervalMs))
  // Simpan antrian; abaikan error agar antrian tidak macet
  queues.set(provider, next.catch(() => {}))
  return next
}

/**
 * Bungkus fungsi async agar otomatis di-throttle per provider.
 *   const safeFetch = throttled('youtube', 1500, (url) => httpGet(url))
 */
export function throttled(provider, minIntervalMs, fn) {
  return async (...args) => {
    await throttle(provider, minIntervalMs)
    return fn(...args)
  }
}

export function reset(provider) {
  if (provider) {
    lastHit.delete(provider)
    queues.delete(provider)
  } else {
    lastHit.clear()
    queues.clear()
  }
}

export default { throttle, throttled, reset }

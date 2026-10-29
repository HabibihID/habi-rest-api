/**
 * lib/cache.js — In-memory TTL cache untuk HABI REST API
 *
 * Prinsip anti-blokir IP: cache agresif untuk endpoint yang datanya
 * tidak berubah cepat → mengurangi request ke provider secara drastis.
 *
 * - Cache per key dengan TTL (milidetik)
 * - Otomatis hapus entry yang expired (lazy, saat diakses)
 * - Batas maksimal entry (default 1000) dengan eviksi LRU sederhana
 * - Aman untuk data yang tidak sensitif dan tidak berubah cepat
 *
 * JANGAN cache: data API key, data order/pembayaran, data real-time kritis.
 *
 * Penggunaan:
 *   import { cached } from '../cache.js'
 *   const data = await cached('jadwalbioskop:jakarta', 30 * 60 * 1000, () => scrapeBioskop('jakarta'))
 */

const store = new Map() // key -> { value, expiresAt, lastAccess }
const MAX_ENTRIES = 1000

function evictIfNeeded() {
  if (store.size < MAX_ENTRIES) return
  // Eviksi entry yang paling lama tidak diakses
  let oldestKey = null
  let oldestAccess = Infinity
  for (const [k, v] of store) {
    if (v.lastAccess < oldestAccess) {
      oldestAccess = v.lastAccess
      oldestKey = k
    }
  }
  if (oldestKey) store.delete(oldestKey)
}

export function get(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  entry.lastAccess = Date.now()
  return entry.value
}

export function set(key, value, ttlMs = 5 * 60 * 1000) {
  evictIfNeeded()
  const now = Date.now()
  store.set(key, { value, expiresAt: now + ttlMs, lastAccess: now })
}

export function del(key) {
  store.delete(key)
}

export function clear() {
  store.clear()
}

export function stats() {
  return { entries: store.size, maxEntries: MAX_ENTRIES }
}

/**
 * Wrapper: kembalikan dari cache bila ada & belum expired,
 * jika tidak, jalankan fn(), simpan hasilnya, lalu kembalikan.
 * Bila fn() melempar dan ada cache basi (stale), kembalikan cache basi
 * sebagai fallback agar layanan tetap jalan saat provider down.
 */
export async function cached(key, ttlMs, fn, { staleFallback = true } = {}) {
  const hit = get(key)
  if (hit !== undefined) return hit

  // Simpan entry basi untuk fallback sebelum dihapus
  const staleEntry = store.get(key)

  try {
    const value = await fn()
    set(key, value, ttlMs)
    return value
  } catch (err) {
    if (staleFallback && staleEntry) {
      return staleEntry.value
    }
    throw err
  }
}

export default { get, set, del, clear, stats, cached }

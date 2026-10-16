// Cache sederhana in-memory dengan TTL untuk hasil ampreset.
// Key: videoId, Value: { data, expiresAt }
const store = new Map()
const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 menit

export function get(key) {
  const e = store.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) { store.delete(key); return null }
  return e.data
}

export function set(key, data, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
  // batasi ukuran cache
  if (store.size > 500) {
    const first = store.keys().next().value
    store.delete(first)
  }
}

export function cacheKey(videoId) { return 'ampreset:' + videoId }

import { validateKey, logUsage } from './db.js'

// Rate limit: 60 requests per minute per key (in-memory)
const hits = new Map()

function checkRate(key) {
  const now = Date.now()
  const window = 60 * 1000
  const arr = (hits.get(key) || []).filter(t => now - t < window)
  arr.push(now)
  hits.set(key, arr)
  return arr.length <= 60
}

setInterval(() => {
  const now = Date.now()
  for (const [k, arr] of hits) {
    const fresh = arr.filter(t => now - t < 60000)
    if (!fresh.length) hits.delete(k)
    else hits.set(k, fresh)
  }
}, 60000).unref()

export function authMiddleware(req, res, next) {
  const key = req.query.apikey || req.headers['x-api-key']
  const row = validateKey(key)

  if (!row) {
    return res.status(401).json({ status: false, message: 'API key tidak valid. Daftar ke admin.' })
  }

  if (!checkRate(key)) {
    return res.status(429).json({ status: false, message: 'Rate limit tercapai (60/menit). Coba lagi nanti.' })
  }

  req.apiKey = row
  logUsage(key, req.path)
  next()
}

export function adminMiddleware(req, res, next) {
  const master = process.env.MASTER_KEY || 'habi_master_default_ganti_ini'
  const key = req.query.master || req.headers['x-master-key']
  if (key !== master) {
    return res.status(403).json({ status: false, message: 'Akses admin ditolak.' })
  }
  next()
}

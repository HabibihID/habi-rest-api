import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authMiddleware, adminMiddleware } from './lib/auth.js'
import { createKey, revokeKey, listKeys } from './lib/db.js'
import downloadRoutes from './routes/download.js'
import generatorRoutes from './routes/generator.js'
import welcomeRoutes from './routes/welcome.js'
import battlecardRoutes from './routes/battlecard.js'
import toolsRoutes from './routes/tools.js'
import gamesRoutes from './routes/games.js'
import islamiRoutes from './routes/islami.js'
import aiRoutes from './routes/ai.js'
import fiturRoutes from './routes/fitur.js'
import storeRoutes from './routes/store.js'
import ampresetRoutes from './routes/ampreset.js'
import paymentRoutes from './routes/payment.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
// Raw binary untuk endpoint upload gambar (harus SEBELUM express.json)
app.use('/api/removebg', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/hd', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/skintoblack', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/tourl', express.raw({ type: ['image/*', 'video/*', 'audio/*', 'application/octet-stream'], limit: '200mb' }))
app.use('/api/topdf', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '15mb' }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ---- Statistik penggunaan API (in-memory) ----
const apiStats = {
  total: 0,
  today: 0,
  todayDate: new Date().toISOString().slice(0, 10),
  byEndpoint: {},
}
function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (apiStats.todayDate !== today) {
    apiStats.todayDate = today
    apiStats.today = 0
    apiStats.byEndpoint = {}
  }
}
function trackApiStats(req, res, next) {
  resetDailyIfNeeded()
  apiStats.total++
  apiStats.today++
  const ep = req.path.split('?')[0]
  apiStats.byEndpoint[ep] = (apiStats.byEndpoint[ep] || 0) + 1
  // Broadcast ke SSE clients (throttle 1 detik)
  if (!broadcastTimer) {
    broadcastTimer = setTimeout(() => { broadcastTimer = null; broadcastStats() }, 1000)
  }
  next()
}

// Statistik publik (tanpa auth, buat website)
app.get('/stats', (req, res) => {
  resetDailyIfNeeded()
  const top = Object.entries(apiStats.byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, hits]) => ({ endpoint, hits }))
  res.json({ status: true, total: apiStats.total, today: apiStats.today, top })
})

// SSE real-time stats
const sseClients = new Set()
app.get('/stats/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  sseClients.add(res)
  // Kirim data langsung pas connect
  sendStatsTo(res)
  req.on('close', () => sseClients.delete(res))
})
function sendStatsTo(res) {
  resetDailyIfNeeded()
  const top = Object.entries(apiStats.byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, hits]) => ({ endpoint, hits }))
  res.write(`data: ${JSON.stringify({ total: apiStats.total, today: apiStats.today, top })}\n\n`)
}
function broadcastStats() {
  for (const res of sseClients) {
    try { sendStatsTo(res) } catch { sseClients.delete(res) }
  }
}
// Broadcast tiap ada request baru (throttle 1 detik)
let broadcastTimer = null

// Health check (tanpa auth) — untuk monitoring & load balancer
const bootTime = Date.now()
app.get('/health', (req, res) => {
  const mem = process.memoryUsage()
  res.json({
    status: true,
    message: 'HABI REST API jalan!',
    version: '2.0.0',
    uptime: Math.floor((Date.now() - bootTime) / 1000),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    },
    time: new Date().toISOString(),
  })
})

// Daftar semua endpoint (dinamis, tanpa auth) — dipakai halaman dokumentasi
app.get('/docs/endpoints', (req, res) => {
  const out = []
  const walk = (stack, prefix = '') => {
    for (const l of stack) {
      if (l.route) {
        const methods = Object.keys(l.route.methods).filter(m => m !== '_all').map(m => m.toUpperCase())
        out.push({ methods, path: prefix + l.route.path })
      } else if (l.name === 'router' && l.handle && l.handle.stack) {
        let mp = ''
        try {
          const src = l.regexp.source
          // /^\/api\/?(?=\/|$)/i  →  /api
          const m = src.match(/\^\\\/([^\\]*)\\\//)
          if (m) mp = '/' + m[1].replace(/\\\//g, '/')
        } catch {}
        walk(l.handle.stack, prefix + mp)
      }
    }
  }
  try { walk(app._router.stack) } catch {}
  const seen = new Set()
  const uniq = out.filter(e => {
    const k = e.methods.join(',') + ' ' + e.path
    if (seen.has(k) || e.path.includes('*')) return false
    seen.add(k); return true
  }).sort((a, b) => a.path.localeCompare(b.path))
  res.json({ status: true, total: uniq.length, endpoints: uniq })
})

// Semua /api/* butuh API key — stats hanya hitung request yang lolos auth
app.use(storeRoutes) // Store Habibi — /store/* tanpa API key, terpisah dari /api
app.use('/api', welcomeRoutes)
app.use('/api', battlecardRoutes)
app.use('/api', authMiddleware, trackApiStats)
app.use('/api', downloadRoutes)
app.use('/api/ampreset', ampresetRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api', generatorRoutes)
app.use('/api', toolsRoutes)
app.use('/api', gamesRoutes)
app.use('/api', islamiRoutes)
app.use('/api', aiRoutes)
app.use('/api/fitur', fiturRoutes)

// Admin: buat API key baru
app.post('/admin/key', adminMiddleware, (req, res) => {
  const name = req.body?.name || req.query?.name || 'user'
  const key = createKey(name)
  res.json({ status: true, apikey: key, name })
})

// Admin: list keys
app.get('/admin/keys', adminMiddleware, (req, res) => {
  res.json({ status: true, keys: listKeys() })
})

// Admin: revoke key
app.post('/admin/revoke', adminMiddleware, (req, res) => {
  const key = req.body?.key || req.query?.key
  if (!key) return res.status(400).json({ status: false, message: '?key= wajib' })
  revokeKey(key)
  res.json({ status: true, message: 'Key di-revoke' })
})

// 404 handler — untuk path yang tidak dikenal
app.use((req, res) => {
  res.status(404).json({ status: false, message: `Endpoint ${req.method} ${req.path} tidak ditemukan. Lihat /docs/endpoints untuk daftar lengkap.` })
})

// Global error handler — jangan biarkan error mentah bocor ke client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    status: false,
    message: status === 500 ? 'Terjadi kesalahan di server, coba lagi nanti.' : err.message,
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HABI REST API v2 jalan di port ${PORT}`)
})

import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authMiddleware, adminMiddleware } from './lib/auth.js'
import { createKey, revokeKey, listKeys } from './lib/db.js'
import downloadRoutes from './routes/download.js'
import generatorRoutes from './routes/generator.js'
import toolsRoutes from './routes/tools.js'
import gamesRoutes from './routes/games.js'
import islamiRoutes from './routes/islami.js'
import aiRoutes from './routes/ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
// Raw binary untuk endpoint upload gambar (harus SEBELUM express.json)
app.use('/api/removebg', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/hd', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/skintoblack', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }))
app.use('/api/tourl', express.raw({ type: ['image/*', 'video/*', 'audio/*', 'application/octet-stream'], limit: '200mb' }))
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
app.use('/api', (req, res, next) => {
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
})

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
const _origNext = null

// Health check (tanpa auth)
app.get('/health', (req, res) => {
  res.json({ status: true, message: 'HABI REST API jalan!', time: new Date().toISOString() })
})

// Semua /api/* butuh API key
app.use('/api', authMiddleware)
app.use('/api', downloadRoutes)
app.use('/api', generatorRoutes)
app.use('/api', toolsRoutes)
app.use('/api', gamesRoutes)
app.use('/api', islamiRoutes)
app.use('/api', aiRoutes)

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HABI REST API jalan di port ${PORT}`)
})

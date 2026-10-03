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
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

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

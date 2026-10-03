// Tools routes — /api/removebg & /api/hd (POST, terima raw image)
// Ditulis dari nol untuk HABI REST API.
//
// /api/removebg:
//   Backend utama: remove.bg API (butuh REMOVE_BG_KEY di env, gratis 50x/bulan).
//   Fallback TANPA key: penghapus background sederhana 100% milik sendiri
//   (flood-fill dari tepi untuk background solid — cocok untuk logo/foto produk
//   dengan background polos). Kualitas AI penuh butuh key remove.bg.
// /api/hd:
//   100% milik sendiri — upscale 2x + sharpen + normalisasi pakai sharp.

import { Router } from 'express'
import express from 'express'
import sharp from 'sharp'
import axios from 'axios'
import { skinToBlack } from '../lib/tools/skintoblack.js'

const router = Router()

const MAX_IMG = 10 * 1024 * 1024 // 10 MB

function needImage(req, res) {
  const buf = req.body
  if (!Buffer.isBuffer(buf) || !buf.length) {
    res.status(400).json({ status: false, message: 'Kirim gambar sebagai raw body (Content-Type: image/*)' })
    return null
  }
  if (buf.length > MAX_IMG) {
    res.status(413).json({ status: false, message: 'Gambar maksimal 10 MB' })
    return null
  }
  return buf
}

// ---- Fallback milik sendiri: hapus background solid via flood-fill dari tepi ----
// Bekerja baik untuk gambar dengan background polos (putih/seragam).
async function removeSolidBackground(input) {
  const img = sharp(input).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info // channels = 4 (RGBA)

  const idx = (x, y) => (y * width + x) * channels
  const visited = new Uint8Array(width * height)

  // Warna referensi: rata-rata piksel tepi
  let r = 0, g = 0, b = 0, n = 0
  const sample = (x, y) => {
    const i = idx(x, y)
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
  }
  for (let x = 0; x < width; x += 4) { sample(x, 0); sample(x, height - 1) }
  for (let y = 0; y < height; y += 4) { sample(0, y); sample(width - 1, y) }
  r /= n; g /= n; b /= n

  const TOL = 38 // toleransi warna
  const similar = (i) =>
    Math.abs(data[i] - r) < TOL &&
    Math.abs(data[i + 1] - g) < TOL &&
    Math.abs(data[i + 2] - b) < TOL

  // BFS flood-fill dari semua tepi
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const p = y * width + x
    if (visited[p]) return
    const i = idx(x, y)
    if (!similar(i)) return
    visited[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1) }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y) }

  while (stack.length) {
    const p = stack.pop()
    const x = p % width, y = Math.floor(p / width)
    // Jadikan transparan
    data[p * channels + 3] = 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

async function removeBgWithApi(input) {
  const key = process.env.REMOVE_BG_KEY
  if (!key) return null
  const r = await axios.post('https://api.remove.bg/v1.0/removebg', input, {
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/octet-stream' },
    responseType: 'arraybuffer',
    timeout: 60000,
    maxBodyLength: MAX_IMG,
  })
  return Buffer.from(r.data)
}

router.post('/removebg',
  // Terima raw binary image
  (req, res, next) => {
    const ct = req.headers['content-type'] || ''
    if (!ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) {
      return res.status(400).json({ status: false, message: 'Content-Type harus image/*' })
    }
    next()
  },
  async (req, res) => {
    const buf = needImage(req, res); if (!buf) return
    try {
      // 1. Coba remove.bg kalau key tersedia (kualitas AI)
      let out = null
      let via = 'solid-fill'
      try {
        out = await removeBgWithApi(buf)
        if (out) via = 'remove.bg'
      } catch (e) {
        // Lanjut ke fallback; catat di header biar transparan
      }
      // 2. Fallback milik sendiri
      if (!out) out = await removeSolidBackground(buf)
      res.set('X-Removebg-Backend', via)
      res.type('image/png').send(out)
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    }
  }
)

router.post('/hd',
  (req, res, next) => {
    const ct = req.headers['content-type'] || ''
    if (!ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) {
      return res.status(400).json({ status: false, message: 'Content-Type harus image/*' })
    }
    next()
  },
  async (req, res) => {
    const buf = needImage(req, res); if (!buf) return
    try {
      const meta = await sharp(buf).metadata()
      const scale = Math.min(2, Math.max(1, 2048 / Math.max(meta.width || 1, meta.height || 1)))
      const out = await sharp(buf)
        .rotate()
        .resize(
          Math.round((meta.width || 512) * scale),
          Math.round((meta.height || 512) * scale),
          { kernel: 'lanczos3', withoutEnlargement: false }
        )
        .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.6 })
        .normalize()
        .jpeg({ quality: 92 })
        .toBuffer()
      res.type('image/jpeg').send(out)
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    }
  }
)

// ---- POST /skintoblack — ubah warna kulit jadi hitam pekat ----
// Terima raw binary image; route-level raw parser supaya tidak bergantung
// pada wiring index.js (express.raw hanya terdaftar untuk /api/removebg & /api/hd).
// NOTE untuk parent: boleh juga menambahkan
//   app.use('/api/skintoblack', express.raw({ type: ['image/*','application/octet-stream'], limit: '10mb' }))
// di index.js seperti route lain.
async function readRawBody(req) {
  if (Buffer.isBuffer(req.body) && req.body.length) return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const buf = Buffer.concat(chunks)
  return buf.length ? buf : null
}

router.post('/skintoblack',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }),
  (req, res, next) => {
    const ct = req.headers['content-type'] || ''
    if (!ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) {
      return res.status(400).json({ status: false, message: 'Content-Type harus image/*' })
    }
    next()
  },
  async (req, res) => {
    const buf = await readRawBody(req)
    if (!buf) return res.status(400).json({ status: false, message: 'Kirim gambar sebagai raw body (Content-Type: image/*)' })
    if (buf.length > MAX_IMG) return res.status(413).json({ status: false, message: 'Gambar maksimal 10 MB' })
    try {
      const out = await skinToBlack(buf)
      res.type('image/png').send(out)
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    }
  }
)

export default router

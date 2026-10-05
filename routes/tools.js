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
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFile, readFile, unlink } from 'fs/promises'
import { skinToBlack } from '../lib/tools/skintoblack.js'
import { blurImage, DEFAULT_BLUR_LEVEL, MAX_BLUR_LEVEL } from '../lib/tools/blur.js'
import { uploadToCatbox } from '../lib/tools/tourl.js'
import { ytTranscript } from '../lib/tools/yttranscript.js'
import { ringkasArtikel } from '../lib/tools/ringkas.js'
import { cryptoPrice } from '../lib/tools/crypto.js'
import { kurs } from '../lib/tools/kurs.js'
import { animeInfo } from '../lib/tools/anime.js'
import { ocrFromUrl } from '../lib/tools/ocr.js'
import { textToSpeech } from '../lib/tools/tts.js'
import { githubInfo } from '../lib/tools/github.js'
import { addWatermark } from '../lib/tools/watermark.js'
import { extractPalette } from '../lib/tools/palette.js'
import { dnsLookup } from '../lib/tools/dns.js'
import { carbon } from '../lib/tools/carbon.js'
import { speedtest } from '../lib/tools/speedtest.js'
import { removeBg } from '../lib/tools/removebg.js'
import { ephoto, ephotoEffects } from '../lib/tools/ephoto.js'
import { enhanceVideo, MAX_VIDEO_SIZE as MAX_VIDEO } from '../lib/tools/hdvideo.js'

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

// ---- POST /api/blur — blur foto (Gaussian blur via sharp) ----
// Terima raw binary image; route-level raw parser supaya tidak bergantung
// pada wiring index.js. Query param: ?level=1-50 (default 15).
router.post('/blur',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }),
  async (req, res) => {
    const buf = await readRawBody(req)
    if (!buf) return res.status(400).json({ status: false, message: 'Kirim gambar sebagai raw body (Content-Type: image/*)' })
    if (buf.length > MAX_IMG) return res.status(413).json({ status: false, message: 'Gambar maksimal 10 MB' })
    const level = Math.min(MAX_BLUR_LEVEL, Math.max(1, parseInt(req.query.level, 10) || DEFAULT_BLUR_LEVEL))
    try {
      const out = await blurImage(buf, level)
      res.type('image/png').send(out)
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    }
  }
)

// ---- Tourl: upload file -> link publik (catbox.moe) ----
router.post('/tourl',
  express.raw({ type: ['image/*', 'video/*', 'audio/*', 'application/octet-stream'], limit: '200mb' }),
  async (req, res) => {
    const buf = req.body
    if (!Buffer.isBuffer(buf) || !buf.length) {
      return res.status(400).json({ status: false, message: 'Kirim file sebagai raw body' })
    }
    try {
      const ct = req.headers['content-type'] || 'application/octet-stream'
      const url = await uploadToCatbox(buf, ct)
      res.json({ status: true, url })
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    }
  }
)

// ---- YouTube Transcript ----
router.get('/yttranscript', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
  try {
    const data = await ytTranscript(url)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- TTS ----
router.get('/tts', async (req, res) => {
  const { text, lang = 'id' } = req.query
  if (!text) return res.status(400).json({ status: false, message: 'Parameter ?text= wajib diisi' })
  try {
    const buf = await textToSpeech(text, lang)
    res.set('Content-Type', 'audio/mpeg')
    res.send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- GitHub info ----
router.get('/github', async (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ status: false, message: 'Parameter ?username= wajib diisi' })
  try {
    const data = await githubInfo(username)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Watermark ----
router.get('/watermark', async (req, res) => {
  const { url, text } = req.query
  if (!url || !text) return res.status(400).json({ status: false, message: 'Parameter ?url= & ?text= wajib diisi' })
  try {
    const buf = await addWatermark(url, text)
    res.set('Content-Type', 'image/jpeg')
    res.send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Palette ----
router.get('/palette', async (req, res) => {
  const { url, count = '5' } = req.query
  if (!url) return res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
  try {
    const colors = await extractPalette(url, count)
    res.json({ status: true, colors })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- OCR ----
router.get('/ocr', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
  try {
    const text = await ocrFromUrl(url)
    res.json({ status: true, text })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- OCR via upload langsung (POST raw image) ----
router.post('/ocr', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '20mb' }), async (req, res) => {
  const buf = req.body
  if (!Buffer.isBuffer(buf) || buf.length < 100) {
    return res.status(400).json({ status: false, message: 'Kirim gambar sebagai raw body' })
  }
  try {
    const { ocrFromBuffer } = await import('../lib/tools/ocr.js')
    const text = await ocrFromBuffer(buf)
    res.json({ status: true, text })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Ringkas artikel ----
router.get('/ringkas', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
  try {
    const data = await ringkasArtikel(url)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Crypto ----
router.get('/crypto', async (req, res) => {
  const coin = req.query.coin
  if (!coin) return res.status(400).json({ status: false, message: 'Parameter ?coin= wajib diisi. Contoh: ?coin=bitcoin' })
  try {
    const data = await cryptoPrice(coin)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Kurs ----
router.get('/kurs', async (req, res) => {
  try {
    const data = await kurs(req.query.from, req.query.to, req.query.amount)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Anime ----
router.get('/anime', async (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= wajib diisi. Contoh: ?q=naruto' })
  try {
    const data = await animeInfo(q)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- RemoveBG: hapus background (terima URL gambar) ----
router.get('/removebg', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
  try {
    const buf = await removeBg(url)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Ephoto ----
router.get('/ephoto', async (req, res) => {
  try {
    const { buffer, mime } = await ephoto(req.query.effect, req.query.text)
    res.type(mime).send(buffer)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

router.get('/ephoto/effects', (req, res) => {
  res.json({ status: true, effects: ephotoEffects() })
})

// ---- HD Video: enhance/upscale video pakai ffmpeg ----
// POST /api/hdvideo — terima raw video body (max 50MB, max 60 detik).
// Route-level express.raw supaya tidak bergantung wiring index.js.
router.post('/hdvideo',
  express.raw({ type: ['video/*', 'application/octet-stream'], limit: '55mb' }),
  async (req, res) => {
    const buf = req.body
    if (!Buffer.isBuffer(buf) || !buf.length) {
      return res.status(400).json({ status: false, message: 'Kirim video sebagai raw body (Content-Type: video/*)' })
    }
    if (buf.length > MAX_VIDEO) {
      return res.status(413).json({ status: false, message: 'Video maksimal 50 MB' })
    }
    const tmpIn = join(tmpdir(), `hdv-in-${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`)
    const tmpOut = join(tmpdir(), `hdv-out-${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`)
    try {
      await writeFile(tmpIn, buf)
      await enhanceVideo(tmpIn, tmpOut)
      const out = await readFile(tmpOut)
      res.type('video/mp4').send(out)
    } catch (e) {
      res.status(500).json({ status: false, message: e.message })
    } finally {
      try { await unlink(tmpIn) } catch {}
      try { await unlink(tmpOut) } catch {}
    }
  }
)

// ---- DNS lookup ----
router.get('/dns', async (req, res) => {
  const { domain, type = 'A' } = req.query
  if (!domain) return res.status(400).json({ status: false, message: 'Parameter ?domain= wajib diisi' })
  try {
    const data = await dnsLookup(domain, type)
    res.json({ status: true, domain, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Carbon: kode jadi gambar ----
router.get('/carbon', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ status: false, message: 'Parameter ?code= wajib diisi' })
  try {
    const buf = await carbon(code)
    res.set('Content-Type', 'image/png')
    res.send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Speedtest ----
router.get('/speedtest', async (req, res) => {
  try {
    const data = await speedtest()
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Wallpaper HD ----
router.get('/wallpaper', async (req, res) => {
  try {
    const seed = Math.floor(Math.random() * 10000)
    const r = await axios.get(`https://picsum.photos/seed/${seed}/1080/1920`, { responseType: 'arraybuffer', timeout: 20000 })
    res.set('Content-Type', 'image/jpeg')
    res.send(Buffer.from(r.data))
  } catch (e) { res.status(500).json({ status: false, message: e.message }) }
})

// ---- Emoji mix ----
router.get('/emojimix', async (req, res) => {
  const { e1, e2 } = req.query
  if (!e1 || !e2) return res.status(400).json({ status: false, message: 'Parameter e1 & e2 wajib diisi' })
  try {
    const r = await axios.get(`https://emojik.vercel.app/s/${encodeURIComponent(e1)}_${encodeURIComponent(e2)}?size=512`, { responseType: 'arraybuffer', timeout: 15000 })
    res.set('Content-Type', 'image/png')
    res.send(Buffer.from(r.data))
  } catch (e) { res.status(500).json({ status: false, message: e.message }) }
})

// ---- Wasted meme (GTA style) ----
router.post('/wasted', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ status: false, message: 'Kirim gambar' })
    const text = (req.query.text || 'wasted').toString().slice(0, 20)
    const img = sharp(req.body)
    const meta = await img.metadata()
    const w = meta.width || 500, h = meta.height || 500

    // Grayscale + darken
    const gray = await img.grayscale().modulate({ brightness: 0.65 }).toBuffer()

    // Text only (no bar) via SVG
    const fontSize = Math.round(h * 0.14)
    const svg = `<svg width="${w}" height="${h}">
      <text x="${w/2}" y="${h/2 + fontSize*0.35}" font-family="Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="#b42828" stroke="black" stroke-width="6" text-anchor="middle" letter-spacing="2">${text.replace(/[<>&]/g, '')}</text>
    </svg>`

    const out = await sharp(gray).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg().toBuffer()
    res.set('Content-Type', 'image/jpeg')
    res.send(out)
  } catch (e) { res.status(500).json({ status: false, message: e.message }) }
})

// ---- Wanted poster ----
router.post('/wanted', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ status: false, message: 'Kirim gambar' })
    const name = (req.query.name || 'WANTED').toString().slice(0, 30)
    const PW = 750, PH = 1050

    // Photo resized
    const photoW = PW - 150, photoH = 400
    const photoX = 75, photoY = 210
    const photoBuf = await sharp(req.body).resize(photoW, photoH, { fit: 'cover' }).toBuffer()

    // Poster via SVG
    const svg = `<svg width="${PW}" height="${PH}">
      <rect width="${PW}" height="${PH}" fill="#b8955a"/>
      <text x="${PW/2}" y="110" font-family="sans-serif" font-weight="900" font-size="90" fill="#0d0800" text-anchor="middle">WANTED</text>
      <text x="${PW/2}" y="175" font-family="sans-serif" font-weight="bold" font-size="38" fill="#0d0800" text-anchor="middle">★ DEAD OR ALIVE ★</text>
      <text x="${PW/2}" y="730" font-family="sans-serif" font-weight="900" font-size="55" fill="#0d0800" text-anchor="middle">$1,000,000 REWARD</text>
      <text x="${PW/2}" y="790" font-family="sans-serif" font-weight="bold" font-size="30" fill="#0d0800" text-anchor="middle">Dangerously Cute and</text>
      <text x="${PW/2}" y="830" font-family="sans-serif" font-weight="bold" font-size="30" fill="#0d0800" text-anchor="middle">Notoriously Good Looking</text>
    </svg>`

    // Red stamp SVG (rotated via sharp)
    const stampW = Math.round(photoW * 0.85), stampH = Math.round(photoH * 0.32)
    const stampSvg = `<svg width="${stampW}" height="${stampH}">
      <rect x="8" y="8" width="${stampW-16}" height="${stampH-16}" fill="none" stroke="#d21919" stroke-width="8"/>
      <rect x="22" y="22" width="${stampW-44}" height="${stampH-44}" fill="none" stroke="#d21919" stroke-width="3"/>
      <text x="${stampW/2}" y="${stampH/2 + stampH*0.16}" font-family="sans-serif" font-weight="900" font-size="${Math.round(stampH*0.42)}" fill="#d21919" text-anchor="middle">WANTED</text>
    </svg>`
    const stampBuf = await sharp(Buffer.from(stampSvg)).rotate(-10, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
    const stampMeta = await sharp(stampBuf).metadata()

    const out = await sharp({ create: { width: PW, height: PH, channels: 3, background: '#b8955a' } })
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: photoBuf, top: photoY, left: photoX },
        { input: stampBuf, top: Math.round(photoY + (photoH - stampMeta.height) / 2), left: Math.round(photoX + (photoW - stampMeta.width) / 2) },
      ])
      .jpeg().toBuffer()
    res.set('Content-Type', 'image/jpeg')
    res.send(out)
  } catch (e) { res.status(500).json({ status: false, message: e.message }) }
})

export default router

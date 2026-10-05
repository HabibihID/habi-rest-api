// Routes AI + RANDOM untuk HABI REST API.
// Ditulis dari nol untuk HABI REST API.
//
// /ai         → ?prompt=        → JSON {status, result} (teks jawaban AI)
// /text2img   → ?prompt=        → gambar langsung (image/jpeg)
// /bluearchive → gambar Blue Archive acak (SFW) — sumber: Safebooru
// /randompap  → foto acak SFW — sumber: Picsum.photos
//
// Catatan: sumber gambar acak yang dipakai:
//   - Blue Archive: Safebooru API publik (safebooru.org) dengan filter
//     tags=blue_archive+rating:safe → file_url yang rating "safe".
//     api.safone.dev/bluearchive dicek MATI (koneksi gagal), jadi tidak dipakai.
//   - Random PAP: https://picsum.photos/800 — foto stok acak, dijamin aman/SFW.

import { Router } from 'express'
import { chatAi, text2img } from '../lib/ai/ai.js'

const router = Router()
const PROXY_BASE = 'https://proxy.servercloud.my.id/proxy'

async function fetchWithTimeout(url, opts = {}, ms) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: c.signal })
  } finally {
    clearTimeout(t)
  }
}

function needPrompt(req, res) {
  const p = req.query.prompt
  if (!p) {
    res.status(400).json({ status: false, message: 'Parameter ?prompt= wajib diisi' })
    return null
  }
  return p
}

async function fetchBinary(url, ms = 60000, contentType) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (HABI-REST-API/1.0)' },
      signal: c.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  } finally {
    clearTimeout(t)
  }
}

// ---- AI chat ----
router.get('/ai', async (req, res) => {
  const prompt = needPrompt(req, res); if (!prompt) return
  try {
    const result = await chatAi(prompt)
    res.json({ status: true, result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- AI text-to-image ----
router.get('/text2img', async (req, res) => {
  const prompt = needPrompt(req, res); if (!prompt) return
  try {
    const buf = await text2img(prompt)
    res.type('image/jpeg').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Blue Archive random (SFW via Safebooru, rating:safe) ----
const SAFEBOORU_API = 'https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1'

router.get('/bluearchive', async (req, res) => {
  try {
    const listUrl = `${SAFEBOORU_API}&limit=100&tags=blue_archive+rating:safe`
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 30000)
    let posts
    try {
      const r = await fetch(listUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (HABI-REST-API/1.0)' },
        signal: c.signal,
      })
      if (!r.ok) throw new Error(`Safebooru HTTP ${r.status}`)
      posts = await r.json()
    } finally { clearTimeout(t) }
    if (!Array.isArray(posts) || !posts.length) throw new Error('Safebooru tidak mengembalikan data.')

    const pick = posts[Math.floor(Math.random() * posts.length)]
    const imgUrl = pick?.sample_url || pick?.file_url
    if (!imgUrl) throw new Error('URL gambar tidak ditemukan.')

    const buf = await fetchBinary(imgUrl, 60000)
    if (!buf.length) throw new Error('Gambar kosong.')
    res.type('image/jpeg').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Random PAP (foto acak, SFW via Picsum.photos) ----
router.get('/randompap', async (req, res) => {
  try {
    const buf = await fetchBinary('https://picsum.photos/800', 60000)
    if (!buf.length) throw new Error('Gambar kosong.')
    res.type('image/jpeg').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- STT: suara jadi teks (Whisper) ----
router.post('/stt', async (req, res) => {
  try {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const buf = Buffer.concat(chunks)
    if (buf.length < 100) return res.status(400).json({ status: false, message: 'Kirim audio sebagai body' })
    const r = await fetchWithTimeout(`${PROXY_BASE}?target=whisper`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: buf,
    }, 60000)
    const j = await r.json()
    if (!j.status) throw new Error(j.message)
    res.json({ status: true, text: j.text })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Sentiment: analisa sentimen teks ----
router.get('/sentiment', async (req, res) => {
  const text = req.query.text
  if (!text) return res.status(400).json({ status: false, message: 'Parameter ?text= wajib diisi' })
  try {
    const r = await fetchWithTimeout(`${PROXY_BASE}?target=sentiment&text=${encodeURIComponent(text)}`, {}, 30000)
    const j = await r.json()
    if (!j.status) throw new Error(j.message)
    const top = j.result.sort((a, b) => b.score - a.score)[0]
    res.json({ status: true, label: top.label, score: top.score, all: j.result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- ImgClass: tebak isi gambar ----
router.post('/imgclass', async (req, res) => {
  try {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const buf = Buffer.concat(chunks)
    if (buf.length < 100) return res.status(400).json({ status: false, message: 'Kirim gambar sebagai body' })
    const r = await fetchWithTimeout(`${PROXY_BASE}?target=imgclass`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: buf,
    }, 60000)
    const j = await r.json()
    if (!j.status) throw new Error(j.message)
    res.json({ status: true, result: j.result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- Translate AI ----
router.get('/translate', async (req, res) => {
  const { text, from = 'english', to = 'indonesian' } = req.query
  if (!text) return res.status(400).json({ status: false, message: 'Parameter ?text= wajib diisi' })
  try {
    const r = await fetchWithTimeout(
      `${PROXY_BASE}?target=translate&text=${encodeURIComponent(text)}&source=${from}&target_lang=${to}`,
      {}, 30000
    )
    const j = await r.json()
    if (!j.status) throw new Error(j.message)
    res.json({ status: true, result: j.result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// ---- AI generators ----
const aiGen = (promptBuilder) => async (req, res) => {
  const q = req.query.q || req.query.text
  if (!q) return res.status(400).json({ status: false, message: 'Parameter q wajib diisi' })
  try {
    const result = await chatAi(promptBuilder(q))
    res.json({ status: true, result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
}

router.get('/cerita', aiGen((q) => `Buatkan cerita pendek yang menarik dalam Bahasa Indonesia tentang: ${q}. Maksimal 300 kata.`))
router.get('/puisi', aiGen((q) => `Buatkan puisi indah dalam Bahasa Indonesia tentang: ${q}. Maksimal 4 bait.`))
router.get('/resep', aiGen((q) => `Berikan resep masakan ${q} dalam Bahasa Indonesia: bahan-bahan dan langkah-langkah yang jelas dan singkat.`))
router.get('/itinerary', aiGen((q) => `Buatkan itinerary traveling ${q} dalam Bahasa Indonesia: destinasi per hari, estimasi biaya, dan tips. Singkat dan jelas.`))

export default router

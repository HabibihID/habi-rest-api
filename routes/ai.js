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

export default router

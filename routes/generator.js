import { Router } from 'express'
import { bratGen, bratVidGen } from '../lib/generators/brat.js'
import { iqcGen } from '../lib/generators/iqc.js'
import { qrGen } from '../lib/generators/qrcode.js'
import { shortlink } from '../lib/generators/shortlink.js'
import { ssweb } from '../lib/generators/ssweb.js'
import { memeGen, memeList } from '../lib/generators/meme.js'
import { translate } from '../lib/generators/translate.js'
import { lirik } from '../lib/generators/lirik.js'

const router = Router()

function needText(req, res, param = 'text') {
  const val = req.query[param]
  if (!val) {
    res.status(400).json({ status: false, message: `Parameter ?${param}= wajib diisi` })
    return null
  }
  return val
}

async function sendBinary(res, fn, mime) {
  try {
    const buf = await fn()
    res.type(mime).send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
}

// ... (existing routes: brat, bratvid, iqc, qrcode, ssweb) ...
router.get('/brat', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => bratGen(text), 'image/png')
})
router.get('/bratvid', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => bratVidGen(text), 'video/mp4')
})
router.get('/iqc', (req, res) => {
  const text = needText(req, res); if (!text) return
  const time = req.query.time || null
  sendBinary(res, () => iqcGen(text, time), 'image/png')
})
router.get('/qrcode', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => qrGen(text), 'image/png')
})
router.get('/ssweb', (req, res) => {
  const url = needText(req, res, 'url'); if (!url) return
  sendBinary(res, () => ssweb(url), 'image/png')
})

// Meme generator
router.get('/meme/:template', (req, res) => {
  const { template } = req.params
  const atas = req.query.atas || ''
  const bawah = req.query.bawah || ''
  sendBinary(res, () => memeGen(template, atas, bawah), 'image/png')
})
router.get('/meme', (req, res) => {
  res.json({ status: true, templates: memeList() })
})

// Translate
router.get('/translate', async (req, res) => {
  const text = needText(req, res); if (!text) return
  const to = req.query.to || 'id'
  const from = req.query.from || 'auto'
  try {
    const result = await translate(text, to, from)
    res.json({ status: true, ...result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// Lirik
router.get('/lirik', async (req, res) => {
  const artist = req.query.artist
  const title = req.query.title
  if (!artist || !title) {
    return res.status(400).json({ status: false, message: 'Parameter ?artist= & ?title= wajib diisi' })
  }
  try {
    const result = await lirik(artist, title)
    res.json({ status: true, ...result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// Shortlink (JSON)
router.get('/shortlink', async (req, res) => {
  const url = needText(req, res, 'url'); if (!url) return
  try {
    const short = await shortlink(url)
    res.json({ status: true, original: url, short })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router

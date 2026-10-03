import { Router } from 'express'
import { bratGen, bratVidGen } from '../lib/generators/brat.js'
import { iqcGen } from '../lib/generators/iqc.js'
import { qrGen } from '../lib/generators/qrcode.js'
import { shortlink } from '../lib/generators/shortlink.js'
import { ssweb } from '../lib/generators/ssweb.js'

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

// Brat text -> image
router.get('/brat', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => bratGen(text), 'image/png')
})

// Brat video
router.get('/bratvid', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => bratVidGen(text), 'video/mp4')
})

// IQC - iPhone Quote Card
router.get('/iqc', (req, res) => {
  const text = needText(req, res); if (!text) return
  const time = req.query.time || null
  sendBinary(res, () => iqcGen(text, time), 'image/png')
})

// QR Code
router.get('/qrcode', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => qrGen(text), 'image/png')
})

// Screenshot web
router.get('/ssweb', (req, res) => {
  const url = needText(req, res, 'url'); if (!url) return
  sendBinary(res, () => ssweb(url), 'image/png')
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

import { Router } from 'express'
import { bratGen, bratVidGen } from '../lib/generators/brat.js'
import { iqcGen } from '../lib/generators/iqc.js'
import { qrGen } from '../lib/generators/qrcode.js'
import { shortlink } from '../lib/generators/shortlink.js'
import { ssweb } from '../lib/generators/ssweb.js'
import { memeGen, memeList } from '../lib/generators/meme.js'
import { translate } from '../lib/generators/translate.js'
import { lirik } from '../lib/generators/lirik.js'
import { fakeChatGen, fakeCallGen } from '../lib/generators/fake.js'
import { fakeDanaGen, fakeOvoGen } from '../lib/generators/fake-ewallet.js'
import { qcwaGen as qcwaGenOld, ttqcGen, igqcGen, qcanimeGen } from '../lib/generators/quote-var.js'
import { kalenderGen, fakeFfGen, fakeMlGen } from '../lib/generators/misc-canvas.js'
import { fakeChIosGen } from '../lib/generators/fakechios.js'
import { qcwaGen } from '../lib/generators/qcwa-port.js'
import { fakeGcIosGen } from '../lib/generators/fakegc.js'
import { fakeDanaPort } from '../lib/generators/fakedana-port.js'
import { fakeCallPort } from '../lib/generators/fakecall-port.js'
import { fakeOvoPort } from '../lib/generators/fakeovo-port.js'

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
  const q = req.query.q
  const artist = req.query.artist
  const title = req.query.title
  // Mode search: ?q=judul lagu
  if (q && !artist && !title) {
    try {
      const result = await lirik('_search_', q)
      return res.json({ status: true, ...result })
    } catch (e) {
      return res.status(500).json({ status: false, message: e.message })
    }
  }
  if (!artist || !title) {
    return res.status(400).json({ status: false, message: 'Parameter ?q= atau ?artist= & ?title= wajib diisi' })
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

// === BATCH CANVAS (port dari ditzzzx) ===
// Fake CH iOS (Channel)
router.get('/fakech', async (req, res) => {
  const nama = needText(req, res, 'nama'); if (!nama) return
  const pengikut = req.query.pengikut || '1.000'
  const jam = req.query.jam || '12.00'
  try {
    // Optional PP via URL
    let ppBuf = null
    if (req.query.pp) {
      const r = await fetch(req.query.pp, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.ok) ppBuf = Buffer.from(await r.arrayBuffer())
    }
    const buf = await fakeChIosGen(nama, pengikut, jam, ppBuf)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
// Fake GC iOS
router.get('/fakegc', async (req, res) => {
  const nama = needText(req, res, 'nama'); if (!nama) return
  const anggota = req.query.anggota || '100'
  try {
    let ppBuf = null
    if (req.query.pp) {
      const r = await fetch(req.query.pp, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.ok) ppBuf = Buffer.from(await r.arrayBuffer())
    }
    const buf = await fakeGcIosGen(nama, anggota, ppBuf)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
// Fake DANA saldo (port ditzzzx)
router.get('/fakedana', async (req, res) => {
  const nominal = needText(req, res, 'nominal'); if (!nominal) return
  try {
    const buf = await fakeDanaPort(nominal)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
// Fake Chat iOS (legacy SVG - akan diganti)
router.get('/fakechat', (req, res) => {
  const nama = req.query.nama || 'Teman'
  const pesan = needText(req, res, 'pesan'); if (!pesan) return
  sendBinary(res, () => fakeChatGen(nama, pesan), 'image/png')
})
// Fake Call (port)
router.get('/fakecall', async (req, res) => {
  const nama = needText(req, res, 'nama'); if (!nama) return
  try {
    const buf = await fakeCallPort(nama)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
// Fake OVO (port)
router.get('/fakeovo', async (req, res) => {
  const nominal = needText(req, res, 'nominal'); if (!nominal) return
  try {
    const buf = await fakeOvoPort(nominal)
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
// Quote variants (port dari ditzzzx)
router.get('/qcwa', async (req, res) => {
  const text = needText(req, res); if (!text) return
  try {
    const buf = await qcwaGen(text, req.query.author || 'Anonymous', req.query.mode || 'dark')
    res.type('image/png').send(buf)
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})
router.get('/ttqc', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => ttqcGen(text, req.query.author), 'image/png')
})
router.get('/igqc', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => igqcGen(text, req.query.author), 'image/png')
})
router.get('/qcanime', (req, res) => {
  const text = needText(req, res); if (!text) return
  sendBinary(res, () => qcanimeGen(text, req.query.author), 'image/png')
})
// Kalender
router.get('/kalender', (req, res) => {
  sendBinary(res, () => kalenderGen(req.query.bulan, req.query.tahun), 'image/png')
})
// Fake FF / ML
router.get('/fakeff', (req, res) => {
  const nick = needText(req, res, 'nick'); if (!nick) return
  sendBinary(res, () => fakeFfGen(nick, req.query.level), 'image/png')
})
router.get('/fakeml', (req, res) => {
  const nick = needText(req, res, 'nick'); if (!nick) return
  sendBinary(res, () => fakeMlGen(nick, req.query.rank), 'image/png')
})

export default router

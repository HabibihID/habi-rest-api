// Stalk routes — /api/stalk-ig, /api/stalk-tiktok, /api/stalk-fb,
// /api/stalk-x, /api/stalk-ff, /api/stalk-ml
// Ditulis dari nol untuk HABI REST API. Scraping publik, tanpa API key.

import { Router } from 'express'
import { stalkIg } from '../lib/stalk/ig.js'
import { stalkTiktok } from '../lib/stalk/tiktok.js'
import { stalkFb } from '../lib/stalk/fb.js'
import { stalkX } from '../lib/stalk/x.js'
import { stalkFf } from '../lib/stalk/ff.js'
import { stalkMl } from '../lib/stalk/ml.js'

const router = Router()

function needParam(req, res, name) {
  const v = (req.query?.[name] || '').toString().trim()
  if (!v) {
    res.status(400).json({ status: false, message: `Parameter ?${name}= wajib diisi` })
    return null
  }
  return v
}

async function run(res, fn, needKeyNote = false) {
  try {
    const result = await fn()
    return res.json({ status: true, result })
  } catch (e) {
    // 404 untuk "tidak ditemukan", 502 untuk kegagalan upstream
    const notFound = /tidak ditemukan|tidak valid|wajib diisi/i.test(e.message)
    return res.status(notFound ? 404 : 502).json({ status: false, message: e.message })
  }
}

router.get('/stalk-ig', (req, res) => {
  const username = needParam(req, res, 'username')
  if (username === null) return
  return run(res, () => stalkIg(username))
})

router.get('/stalk-tiktok', (req, res) => {
  const username = needParam(req, res, 'username')
  if (username === null) return
  return run(res, () => stalkTiktok(username))
})

router.get('/stalk-fb', (req, res) => {
  const username = needParam(req, res, 'username')
  if (username === null) return
  return run(res, () => stalkFb(username))
})

router.get('/stalk-x', (req, res) => {
  const username = needParam(req, res, 'username')
  if (username === null) return
  return run(res, () => stalkX(username))
})

router.get('/stalk-ff', (req, res) => {
  const id = needParam(req, res, 'id')
  if (id === null) return
  return run(res, () => stalkFf(id))
})

router.get('/stalk-ml', (req, res) => {
  const id = needParam(req, res, 'id')
  if (id === null) return
  const zone = needParam(req, res, 'zone')
  if (zone === null) return
  return run(res, () => stalkMl(id, zone))
})

export default router

// Islami routes — /api/kisahnabi
// Ditulis dari nol untuk HABI REST API. Bank lokal, tanpa API luar.

import { Router } from 'express'
import { getKisahNabi, listNabi } from '../lib/islami/kisahnabi.js'

const router = Router()

// GET /api/kisahnabi?nabi=muhammad
// Tanpa parameter → daftar 25 nama nabi
router.get('/kisahnabi', (req, res) => {
  const nama = (req.query?.nabi || '').trim()
  if (!nama) {
    return res.json({ status: true, daftar: listNabi() })
  }
  const nabi = getKisahNabi(nama)
  if (!nabi) {
    return res.status(404).json({
      status: false,
      message: `Nabi "${nama}" tidak ditemukan. Gunakan nama 25 nabi & rasul.`
    })
  }
  return res.json({ status: true, result: nabi })
})

export default router

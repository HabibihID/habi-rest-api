// Islami routes — /api/kisahnabi
// Ditulis dari nol untuk HABI REST API. Bank lokal, tanpa API luar.

import { Router } from 'express'
import { getKisahNabi, listNabi } from '../lib/islami/kisahnabi.js'
import { getSholatTimings } from '../lib/islami/sholat-timings.js'
import { randomHadits, haditsByNo, cariHadits, HADITS } from '../lib/islami/hadits.js'

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


// GET /api/hadits          -> acak; ?no=5 -> nomor tertentu (Arba'in)
// GET /api/hadits/cari?q=niat -> cari berdasarkan tema/isi (maks 5)
router.get('/hadits/cari', (req, res) => {
  const q = (req.query?.q || '').trim()
  if (!q) return res.status(400).json({ status: false, message: 'Parameter q wajib diisi.' })
  const hasil = cariHadits(q)
  if (!hasil.length) return res.status(404).json({ status: false, message: `Tidak ada hadits Arba'in yang cocok dengan "${q}".` })
  return res.json({ status: true, result: hasil })
})

router.get('/hadits', (req, res) => {
  if (req.query?.no) {
    const h = haditsByNo(req.query.no)
    if (!h) return res.status(404).json({ status: false, message: `Hadits Arba'in nomor ${req.query.no} tidak ada di bank (tersedia ${HADITS.length} hadits).` })
    return res.json({ status: true, result: h })
  }
  return res.json({ status: true, result: randomHadits() })
})

// GET /api/sholat/timings?city=Jakarta - jadwal sholat (Aladhan direct + fallback geocode)
router.get('/sholat/timings', async (req, res) => {
  const city = (req.query?.city || '').trim()
  if (!city) {
    return res.status(400).json({ status: false, message: 'Parameter city wajib diisi.' })
  }
  const data = await getSholatTimings(city)
  if (!data) {
    return res.status(404).json({ status: false, message: `Jadwal sholat untuk kota "${city}" tidak ditemukan.` })
  }
  return res.json({ status: true, data: { city, ...data } })
})

export default router

// Games routes — 6 endpoint kuis tebak-tebakan dari bank soal lokal.
// Ditulis dari nol untuk HABI REST API. Tanpa API pihak ketiga.
//
// GET /api/tebakbendera  -> { status:true, result:{ soal, jawaban } }
// GET /api/tebaklogo     -> { status:true, result:{ deskripsi, img, jawaban } }
// GET /api/tebaklirik    -> { status:true, result:{ soal, jawaban } }
// GET /api/tebakapakahaku-> { status:true, result:{ soal, jawaban } }
// GET /api/tebakkata     -> { status:true, result:{ soal, jawaban } }
// GET /api/caklontong    -> { status:true, result:{ soal, jawaban, keterangan } }

import { Router } from 'express'
import {
  tebakbendera,
  tebaklogo,
  tebaklirik,
  tebakapakahaku,
  tebakkata,
  caklontong,
} from '../lib/games/banks.js'

const router = Router()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

router.get('/tebakbendera', (req, res) => {
  const item = pick(tebakbendera)
  res.json({ status: true, result: { soal: item.soal, jawaban: item.jawaban } })
})

router.get('/tebaklogo', (req, res) => {
  const item = pick(tebaklogo)
  res.json({ status: true, result: { deskripsi: item.deskripsi, img: item.img, jawaban: item.jawaban } })
})

router.get('/tebaklirik', (req, res) => {
  const item = pick(tebaklirik)
  res.json({ status: true, result: { soal: item.soal, jawaban: item.jawaban } })
})

router.get('/tebakapakahaku', (req, res) => {
  const item = pick(tebakapakahaku)
  res.json({ status: true, result: { soal: item.soal, jawaban: item.jawaban } })
})

router.get('/tebakkata', (req, res) => {
  const item = pick(tebakkata)
  res.json({ status: true, result: { soal: item.soal, jawaban: item.jawaban } })
})

router.get('/caklontong', (req, res) => {
  const item = pick(caklontong)
  res.json({ status: true, result: { soal: item.soal, jawaban: item.jawaban, keterangan: item.keterangan } })
})

export default router

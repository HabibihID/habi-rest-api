import { Router } from 'express'
import { getComments, extractVideoId } from '../lib/ampreset/providers.js'
import { parseComments } from '../lib/ampreset/parser.js'
import { get as cacheGet, set as cacheSet, cacheKey } from '../lib/ampreset/cache.js'
import { enqueue } from '../lib/ampreset/queue.js'
import { getTikTokAmPreset } from '../lib/ampreset/tiktok-am-preset.mjs'

const router = Router()

// GET /api/ampreset?url=<tiktok_url>
// Arsitektur: cache → queue → multi-provider komentar → parser semua URL.
router.get('/', async (req, res) => {
  const url = req.query.url
  if (!url) return res.json({ status: false, message: 'Parameter url wajib diisi.' })

  const videoId = extractVideoId(url) || url
  const key = cacheKey(videoId)

  // 1. cache dulu
  const cached = cacheGet(key)
  if (cached) {
    return res.json({ ...cached, cached: true })
  }

  // 1b. Mesin utama (modul kiriman user 2026-10-21): baca komentar +
  // balasan publik TikTok; preset AM biasanya dibagikan di balasan.
  try {
    const d = await getTikTokAmPreset({ url })
    const urls = [
      ...d.links.map((l) => ({ type: 'Alight Motion', url: l.url, from: 'TikTok' })),
      ...d.candidates.map((c) => ({ type: 'Kandidat', url: c.url, from: 'TikTok' })),
    ]
    const out = {
      status: true,
      video_id: d.videoId,
      provider: 'tiktok-replies',
      total_comments: d.commentsScanned + d.repliesScanned,
      total_urls: urls.length,
      urls,
      by_user: { TikTok: urls },
      truncated: d.pagination.truncated,
    }
    cacheSet(key, out)
    return res.json(out)
  } catch { /* upstream gagal -> rantai provider lama di bawah */ }

  // 2. queue agar tidak spam provider
  let ds
  try {
    ds = await enqueue(() => getComments(url))
  } catch (e) {
    return res.json({ status: false, message: 'Queue error: ' + e.message })
  }

  if (!ds.ok) {
    return res.json({
      status: false,
      message: ds.error,
      code: ds.code,
      details: ds.details || [],
      note: ds.note || 'Tidak ada bypass anti-bot TikTok di server ini.',
    })
  }

  // 3. parser ekstrak SEMUA URL dari seluruh komentar
  const parsed = parseComments(ds.comments)

  const out = {
    status: true,
    video_id: ds.videoId,
    provider: ds.provider,
    total_comments: ds.total,
    total_urls: parsed.total,
    urls: parsed.urls,
    by_user: parsed.byUser,
  }

  // 4. simpan cache
  cacheSet(key, out)
  return res.json(out)
})

// GET /api/ampreset/providers — lihat provider aktif & env
router.get('/providers', (req, res) => {
  const order = (process.env.AMPRESET_PROVIDER || 'direct,socialkit,scraptik').split(',')
  res.json({
    status: true,
    order,
    configured: {
      socialkit: !!process.env.SOCIALKIT_KEY,
      scraptik: !!process.env.SCRAPTIK_KEY,
    },
  })
})

export default router

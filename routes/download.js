import { Router } from 'express'
import { tiktokDl } from '../lib/downloaders/tiktok.js'
import { tiktokSearch } from '../lib/downloaders/tiktok-search.js'
import { facebookDl } from '../lib/downloaders/facebook.js'
import { youtubeDl } from '../lib/downloaders/youtube.js'
import { pinterestDl } from '../lib/downloaders/pinterest.js'
import { twitterDl } from '../lib/downloaders/twitter.js'
import { instagramDl } from '../lib/downloaders/instagram.js'
import { capcutDl } from '../lib/downloaders/capcut.js'
import { gdriveDl } from '../lib/downloaders/gdrive.js'
import { ytSearch } from '../lib/downloaders/ytsearch.js'
import { aioDl } from '../lib/downloaders/aio.js'
import { mediafireDl } from '../lib/downloaders/mediafire.js'
import { spotifyDl } from '../lib/downloaders/spotify.js'
import { spSearch, spAlbum } from '../lib/downloaders/spotifyPartner.js'
import { spPlaySearch, spPlayAudio } from '../lib/downloaders/spotmp3.js'
import { threadsDl } from '../lib/downloaders/threads.js'
import { snackDl } from '../lib/downloaders/snackvideo.js'
import { soundcloudDl, soundcloudDownload } from '../lib/downloaders/soundcloud.js'
import { redditDl } from '../lib/downloaders/reddit.js'
import { ytdlInfo, ytdlDownload } from '../lib/downloaders/ytdl.js'
import { siteInfo, siteSearch, convert, extractId } from '../lib/downloaders/ytmp3pc.js'

import fs from 'node:fs'
const router = Router()

function needUrl(req, res) {
  const url = req.query.url
  if (!url) {
    res.status(400).json({ status: false, message: 'Parameter ?url= wajib diisi' })
    return null
  }
  return url
}

async function handle(res, fn) {
  try {
    const data = await fn()
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
}

// TikTok video
router.get('/tiktok', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => tiktokDl(url))
})

// TikTok audio only
router.get('/tiktokaudio', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, async () => {
    const d = await tiktokDl(url)
    return { title: d.title, author: d.author, audio: d.audio }
  })
})

// TikTok search by keyword
router.get('/tiktoksearch', (req, res) => {
  const q = (req.query.q || req.query.query || '').trim()
  if (!q) return res.status(400).json({ status: false, message: 'Parameter q (kata kunci) wajib diisi' })
  const count = Math.max(1, Math.min(parseInt(req.query.count) || 15, 30))
  handle(res, () => tiktokSearch(q, count))
})

// Facebook
router.get('/facebook', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => facebookDl(url))
})

// YouTube (mp3/mp4)
router.get('/youtube', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  const type = req.query.type === 'mp3' ? 'mp3' : 'mp4'
  handle(res, () => youtubeDl(url, type))
})

// Pinterest
router.get('/pinterest', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => pinterestDl(url))
})

// Twitter/X
router.get('/twitter', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => twitterDl(url))
})

// Instagram
router.get('/instagram', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => instagramDl(url))
})

// CapCut
router.get('/capcut', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => capcutDl(url))
})

// Google Drive
router.get('/gdrive', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => gdriveDl(url))
})

// YouTube search
router.get('/ytsearch', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= wajib diisi' })
  const limit = Math.min(parseInt(req.query.limit) || 10, 20)
  handle(res, () => ytSearch(q, limit))
})

// All-in-one media downloader
router.get('/aio', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => aioDl(url))
})


// MediaFire
router.get('/mediafire', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => mediafireDl(url))
})

// Spotify
router.get('/spotify', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => spotifyDl(url))
})

// Spotify search (Partner API) + info album
router.get('/spsearch', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= wajib diisi' })
  const limit = Math.min(parseInt(req.query.limit) || 10, 25)
  handle(res, () => spSearch(q, { limit }))
})

router.get('/spotify/album', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => spAlbum(url))
})

// Spotify Play (SpotMP3): cari lagu lalu siapkan MP3-nya (job async)
router.get('/spplay/search', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= wajib diisi' })
  const limit = Math.min(parseInt(req.query.limit) || 8, 15)
  handle(res, () => spPlaySearch(q, limit))
})

router.get('/spplay/audio', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => spPlayAudio(url))
})

// SoundCloud (halaman track publik + resolusi stream api-v2)
router.get('/soundcloud', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => soundcloudDl(url))
})

// SoundCloud unduh MP3 (HLS -> ffmpeg lokal; pola sama seperti /ytdl)
router.get('/soundcloud/download', async (req, res) => {
  const url = needUrl(req, res); if (!url) return
  let dl = null
  try {
    dl = await soundcloudDownload(url)
    res.setHeader('Content-Type', dl.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dl.fileName)}"`)
    res.setHeader('X-SC-Title', encodeURIComponent(dl.title || ''))
    res.setHeader('X-SC-Artist', encodeURIComponent(dl.artist || ''))
    const stream = fs.createReadStream(dl.filePath)
    stream.on('end', () => dl.cleanup())
    stream.on('error', () => dl.cleanup())
    stream.pipe(res)
  } catch (e) {
    if (dl) dl.cleanup()
    res.status(500).json({ status: false, message: e.message })
  }
})

// Reddit (JSON publik postingan; Reddit sering memblokir IP datacenter)
router.get('/reddit', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => redditDl(url))
})

// SnackVideo (halaman publik, ekstrak metadata video)
router.get('/snackvideo', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => snackDl(url))
})

// Threads (butuh headless browser di server)
router.get('/threads', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => threadsDl(url))
})

// YouTube MP3/MP4 via yt-dlp lokal (auto-hapus setelah dikirim)
router.get('/ytdl/info', (req, res) => {
  const q = req.query.q || req.query.url
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= atau ?url= wajib diisi' })
  handle(res, () => ytdlInfo(q))
})

router.get('/ytdl', async (req, res) => {
  const q = req.query.q || req.query.url
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= atau ?url= wajib diisi' })
  const format = req.query.format === 'mp4' ? 'mp4' : 'mp3'
  let dl = null
  try {
    dl = await ytdlDownload(q, format)
    res.setHeader('Content-Type', dl.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dl.fileName)}"`)
    res.setHeader('X-YTDL-Title', encodeURIComponent(dl.title || ''))
    res.setHeader('X-YTDL-Duration', String(dl.duration || 0))
    const stream = fs.createReadStream(dl.filePath)
    stream.on('end', () => dl.cleanup())
    stream.on('error', () => dl.cleanup())
    stream.pipe(res)
  } catch (e) {
    if (dl) dl.cleanup()
    res.status(500).json({ status: false, message: e.message })
  }
})


// YTMp3PC — YouTube info/search/convert via ytmp3pc.com (pihak ketiga, atas minta user)
// GET /api/ytmp3pc/info?url=<url|id>
// GET /api/ytmp3pc/search?q=<query>
// GET /api/ytmp3pc/convert?url=<url|id>&format=mp3|mp4&quality=<q>  → JSON (downloadUrl)
router.get('/ytmp3pc/info', (req, res) => {
  const q = req.query.q || req.query.url
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= atau ?url= wajib diisi' })
  handle(res, async () => {
    const id = extractId(q)
    return await siteInfo(id)
  })
})

router.get('/ytmp3pc/search', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= wajib diisi' })
  handle(res, () => siteSearch(q))
})

router.get('/ytmp3pc/convert', (req, res) => {
  const q = req.query.q || req.query.url
  if (!q) return res.status(400).json({ status: false, message: 'Parameter ?q= atau ?url= wajib diisi' })
  const format = req.query.format === 'mp4' ? 'mp4' : 'mp3'
  handle(res, async () => {
    const id = extractId(q)
    const c = await convert(id, format, req.query.quality)
    const { headers, ...rest } = c
    return { provider: 'ytmp3pc', ...rest }
  })
})

export default router

// Terabox (resolver sendiri, alur web publik tanpa login)
import { teraboxList, teraboxDownloadStream } from '../lib/downloaders/terabox.js'
router.get('/terabox/list', async (req, res) => {
  try {
    const url = (req.query.url || '').toString().trim()
    if (!url) return res.status(400).json({ status: false, message: 'url wajib diisi' })
    const data = await teraboxList(url)
    res.json({ status: true, data })
  } catch (e) { res.status(400).json({ status: false, message: e.message }) }
})
router.get('/terabox/download', async (req, res) => {
  try {
    const url = (req.query.url || '').toString().trim()
    const fsid = (req.query.fsid || '').toString().trim()
    if (!url || !fsid) return res.status(400).json({ status: false, message: 'url & fsid wajib diisi' })
    await teraboxDownloadStream(url, fsid, res)
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ status: false, message: e.message })
    else res.end()
  }
})

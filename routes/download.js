import { Router } from 'express'
import { tiktokDl } from '../lib/downloaders/tiktok.js'
import { facebookDl } from '../lib/downloaders/facebook.js'
import { youtubeDl } from '../lib/downloaders/youtube.js'
import { pinterestDl } from '../lib/downloaders/pinterest.js'
import { twitterDl } from '../lib/downloaders/twitter.js'
import { instagramDl } from '../lib/downloaders/instagram.js'
import { capcutDl } from '../lib/downloaders/capcut.js'
import { gdriveDl } from '../lib/downloaders/gdrive.js'
import { ytSearch } from '../lib/downloaders/ytsearch.js'
import { threadsDl } from '../lib/downloaders/threads.js'
import { mediafireDl } from '../lib/downloaders/mediafire.js'
import { spotifyDl } from '../lib/downloaders/spotify.js'

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

// Threads
router.get('/threads', (req, res) => {
  const url = needUrl(req, res); if (!url) return
  handle(res, () => threadsDl(url))
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

export default router

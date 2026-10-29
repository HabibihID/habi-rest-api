// TikTok search by keyword — via tikwm API (port dari kode IzzXd, disesuaikan standar API v2)
// Legal: request HTTPS biasa ke API publik, tanpa bypass anti-bot
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'
import { cached } from '../cache.js'

const PROVIDER = 'tikwm'
const BASE = 'https://www.tikwm.com'
const CACHE_TTL = 10 * 60 * 1000 // 10 menit (sama kayak ytsearch)

function normalizeItem(v) {
  const id = v.video_id || v.id || ''
  const isPhoto = Array.isArray(v.images) && v.images.length > 0
  const fix = u => u?.startsWith('http') ? u : (u ? `${BASE}${u}` : null)
  return {
    id,
    type: isPhoto ? 'photo' : 'video',
    title: (v.title || '').trim() || null,
    url: `https://www.tiktok.com/@${v.author?.unique_id || 'user'}/${isPhoto ? 'photo' : 'video'}/${id}`,
    author: {
      unique_id: v.author?.unique_id || null,
      nickname: v.author?.nickname || null,
      avatar: fix(v.author?.avatar) || null,
    },
    duration: Number(v.duration) || null,
    create_time: Number(v.create_time) || null,
    stats: {
      play: Number(v.play_count) || 0,
      like: Number(v.digg_count) || 0,
      comment: Number(v.comment_count) || 0,
      share: Number(v.share_count) || 0,
    },
    music: {
      title: v.music_info?.title || null,
      author: v.music_info?.author || null,
    },
    thumbnail: fix(v.cover || v.origin_cover) || null,
    video_hd: fix(v.hdplay) || null,
    video: fix(v.play) || null,
    images: isPhoto ? v.images.map(fix).filter(Boolean) : [],
  }
}

export async function tiktokSearch(keyword, count = 15) {
  const clean = (keyword || '').trim()
  if (!clean) throw new Error('Kata kunci tidak boleh kosong')
  const target = Math.max(1, Math.min(count, 30))
  const cacheKey = `tiktoksearch:${clean.toLowerCase()}:${target}`

  return cached(cacheKey, CACHE_TTL, async () => {
    const results = []
    const seen = new Set()
    let cursor = 0

    while (results.length < target && cursor < target * 3) {
      await throttle(PROVIDER, 2000)
      const j = await httpGet(
        `${BASE}/api/feed/search/?keywords=${encodeURIComponent(clean)}&count=30&cursor=${cursor}&HD=1`,
        { provider: PROVIDER, timeout: 20000 }
      )
      if (j?.code !== 0) throw new Error(j?.msg || 'tikwm search error')
      const videos = j?.data?.videos || []
      if (!videos.length) break
      for (const item of videos) {
        const id = item.video_id || item.id
        if (!id || seen.has(id)) continue
        seen.add(id)
        results.push(normalizeItem(item))
        if (results.length >= target) break
      }
      cursor += 30
    }

    if (!results.length) throw new Error(`Tidak ditemukan video untuk: "${clean}"`)
    return { keyword: clean, total: results.length, results }
  })
}

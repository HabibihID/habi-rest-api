// Provider komentar TikTok — pluggable, tanpa bypass anti-bot.
// Urutan: coba provider yang dikonfigurasi via env. Tambah provider baru
// cukup tambah fungsi di sini tanpa ubah route/parser.
//
// Env:
//   AMPRESET_PROVIDER=hierarki koma, cth: socialkit,scraptik,direct
//   SOCIALKIT_KEY=...
//   SCRAPTIK_KEY=... (RapidAPI key)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function resolveUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD', headers: { 'User-Agent': UA },
      redirect: 'follow', signal: AbortSignal.timeout(15000),
    })
    return res.url || url
  } catch { return url }
}

export function extractVideoId(url) {
  const m = String(url).match(/video\/(\d+)/)
  return m ? m[1] : null
}

// ---- provider: direct (endpoint publik TikTok, tanpa bypass) ----
async function viaDirect(videoId, fullUrl) {
  const apiUrl = `https://www.tiktok.com/api/comment/list/?aweme_id=${videoId}&count=50&cursor=0`
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.tiktok.com/', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (res.status === 403 || res.status === 429)
    return { ok: false, code: 'TIKTOK_BLOCKED', error: 'TikTok memblokir IP server.' }
  if (!res.ok)
    return { ok: false, code: 'TIKTOK_ERROR', error: `TikTok HTTP ${res.status}` }
  const data = await res.json()
  const comments = (data.comments || []).map(c => ({
    username: c.user?.unique_id || c.user?.nickname || 'unknown',
    text: c.text || '',
  }))
  if (!comments.length)
    return { ok: false, code: 'NO_COMMENTS', error: 'Tidak ada komentar.' }
  return { ok: true, comments, provider: 'direct' }
}

// ---- provider: SocialKit ----
async function viaSocialKit(videoId, fullUrl) {
  const key = process.env.SOCIALKIT_KEY
  if (!key) return { ok: false, code: 'NO_KEY', error: 'SOCIALKIT_KEY belum diset.' }
  const u = `https://api.socialkit.dev/tiktok/comments?url=${encodeURIComponent(fullUrl)}&limit=100`
  const res = await fetch(u, {
    headers: { 'x-access-key': key },
    signal: AbortSignal.timeout(45000),
  })
  const j = await res.json().catch(() => null)
  if (!j?.success)
    return { ok: false, code: 'SOCIALKIT_ERROR', error: j?.message || `SocialKit HTTP ${res.status}` }
  const comments = (j.data?.comments || []).map(c => ({
    username: c.username || c.author || 'unknown',
    text: c.text || '',
  }))
  if (!comments.length)
    return { ok: false, code: 'NO_COMMENTS', error: 'SocialKit: tidak ada komentar.' }
  return { ok: true, comments, provider: 'socialkit' }
}

// ---- provider: ScrapTik (via RapidAPI) ----
async function viaScrapTik(videoId, fullUrl) {
  const key = process.env.SCRAPTIK_KEY
  if (!key) return { ok: false, code: 'NO_KEY', error: 'SCRAPTIK_KEY belum diset.' }
  const res = await fetch('https://scraptik.p.rapidapi.com/tiktok_video_comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': key,
      'x-rapidapi-host': 'scraptik.p.rapidapi.com',
    },
    body: JSON.stringify({ video_url: fullUrl, count: 100 }),
    signal: AbortSignal.timeout(45000),
  })
  const j = await res.json().catch(() => null)
  const list = j?.comments || j?.data?.comments || []
  const comments = list.map(c => ({
    username: c.username || c.author || 'unknown',
    text: c.text || c.comment || '',
  }))
  if (!comments.length)
    return { ok: false, code: 'NO_COMMENTS', error: 'ScrapTik: tidak ada komentar.' }
  return { ok: true, comments, provider: 'scraptik' }
}

const PROVIDERS = { direct: viaDirect, socialkit: viaSocialKit, scraptik: viaScrapTik }

export async function getComments(tiktokUrl, maxComments = 200) {
  const fullUrl = await resolveUrl(tiktokUrl)
  const videoId = extractVideoId(fullUrl)
  if (!videoId)
    return { ok: false, code: 'INVALID_URL', error: 'URL TikTok tidak valid.' }

  const order = (process.env.AMPRESET_PROVIDER || 'direct,socialkit,scraptik')
    .split(',').map(s => s.trim()).filter(Boolean)

  const errors = []
  for (const name of order) {
    const fn = PROVIDERS[name]
    if (!fn) continue
    try {
      const r = await fn(videoId, fullUrl)
      if (r.ok) {
        r.comments = r.comments.slice(0, maxComments)
        r.total = r.comments.length
        r.videoId = videoId
        return r
      }
      errors.push(`${name}: ${r.error}`)
    } catch (e) {
      errors.push(`${name}: ${e.message}`)
    }
  }
  return {
    ok: false, code: 'ALL_PROVIDERS_FAILED',
    error: 'Semua provider komentar gagal.',
    details: errors,
    note: 'Set API key provider via env SOCIALKIT_KEY / SCRAPTIK_KEY untuk mengaktifkan provider berbayar.',
  }
}

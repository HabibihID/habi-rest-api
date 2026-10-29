// Pinsearch — Pencarian Pinterest (foto/video/gif) untuk HABI REST API.
// Diadaptasi dari Pinterest Search scraper (Razeerh) atas kiriman user 2026-10-21:
// bootstrap sesi (csrftoken) + Pinterest BaseSearchResource, hasil dinormalisasi ringkas.
import axios from 'axios'

const BASE = 'https://www.pinterest.com'
const RESOURCE = `${BASE}/resource/BaseSearchResource/get/`
const PWS_HANDLER = 'www/search/[scope].js'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Sesi (di-cache ~20 menit, bootstrap ulang bila ditolak) ----
let cachedSession = null
let sessionAt = 0
const SESSION_TTL = 20 * 60 * 1000

async function bootstrapSession(timeout = 20000) {
  const res = await axios.get(`${BASE}/search/pins/`, {
    params: { q: 'nature' },
    timeout,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  })
  const raw = res.headers['set-cookie'] || []
  const jar = {}
  for (const line of raw) {
    const pair = line.split(';')[0]
    const eq = pair.indexOf('=')
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  const csrf = jar.csrftoken
  if (!csrf) throw new Error('Gagal mendapatkan csrftoken dari Pinterest')
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
  cachedSession = { csrf, cookie }
  sessionAt = Date.now()
  return cachedSession
}

async function getSession(force = false) {
  if (!force && cachedSession && Date.now() - sessionAt < SESSION_TTL) return cachedSession
  return bootstrapSession()
}

function buildHeaders(session, query) {
  return {
    'User-Agent': UA,
    Accept: 'application/json, text/javascript, */*, q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Pinterest-AppState': 'active',
    'X-Pinterest-PWS-Handler': PWS_HANDLER,
    'X-Pinterest-Source-Url': `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`,
    'x-csrftoken': session.csrf,
    Referer: `${BASE}/search/pins/?q=${encodeURIComponent(query)}`,
    Cookie: session.cookie,
  }
}

async function fetchPage(session, query, bookmark, pageSize = 25) {
  const options = {
    query,
    scope: 'pins',
    rs: 'typed',
    page_size: pageSize,
    enable_promoted_pins: false,
  }
  if (bookmark) options.bookmarks = [bookmark]
  const data = JSON.stringify({ options, context: {} })

  const res = await axios.get(RESOURCE, {
    params: { source_url: `/search/pins/?q=${query}&rs=typed`, data, _: Date.now() },
    timeout: 20000,
    validateStatus: () => true,
    headers: buildHeaders(session, query),
  })
  if (res.status !== 200) {
    const msg = typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data).slice(0, 200)
    throw new Error(`HTTP ${res.status}: ${msg}`)
  }
  const body = res.data
  if (!body || !body.resource_response) throw new Error('Respons tidak berisi resource_response')
  const rr = body.resource_response
  if (rr.status === 'failure') {
    const m = rr.error ? rr.error.message : rr.message
    throw new Error(`API error: ${m}`)
  }
  return rr
}

// ---- Pemetaan pin ----
function classifyMedia(pin) {
  if (pin.videos && pin.videos.video_list) return 'video'
  const orig = pin.images && pin.images.orig && pin.images.orig.url
  const xl = pin.image_xlarge_url
  const candidate = orig || xl || (pin.images && pin.images['736x'] && pin.images['736x'].url) || ''
  if (/\.gif(\?|$)/i.test(candidate)) return 'gif'
  return 'foto'
}

function pickImage(pin) {
  const imgs = pin.images || {}
  const orig = imgs.orig
  const large = imgs['736x'] || imgs['564x'] || imgs['474x'] || imgs['236x']
  const thumb = imgs['236x'] || imgs['170x'] || large || orig
  return { orig, large, thumb }
}

function pickVideo(pin) {
  const list = pin.videos && pin.videos.video_list
  if (!list) return null
  const preferred = ['V_720P', 'V_EXP7', 'V_480P', 'V_HLSV4', 'V_HLSV3_MOBILE']
  for (const key of preferred) {
    if (list[key]) return { key, ...list[key] }
  }
  const firstKey = Object.keys(list)[0]
  return firstKey ? { key: firstKey, ...list[firstKey] } : null
}

function mapPin(pin) {
  const { orig, large, thumb } = pickImage(pin)
  const media = classifyMedia(pin)
  const video = pickVideo(pin)
  const base = orig || large || thumb || {}

  let mediaUrl = null
  if (media === 'video' && video) mediaUrl = video.url
  else if (base.url) mediaUrl = base.url

  const pinner = pin.pinner || {}
  const id = String(pin.id)

  return {
    id,
    title: pin.title || pin.grid_title || '',
    description: pin.description || '',
    media_type: media,
    pin_url: `${BASE}/pin/${id}/`,
    media_url: mediaUrl,
    thumbnail: (thumb && thumb.url) || (video && video.thumbnail) || null,
    width: base.width || null,
    height: base.height || null,
    duration_seconds: video && video.duration ? Number((video.duration / 1000).toFixed(1)) : null,
    creator: {
      name: pinner.full_name || null,
      username: pinner.username || null,
    },
    source_domain: pin.domain || null,
  }
}

/**
 * Cari pin Pinterest. type: 'all' | 'foto' | 'video' | 'gif'. limit default 20 (maks 50).
 */
export async function searchPinterest(query, { limit = 20, type = 'all' } = {}) {
  if (!query) throw new Error('Query pencarian Pinterest tidak boleh kosong.')
  const maxLimit = Math.min(50, Math.max(1, Number(limit) || 20))
  const validTypes = ['all', 'foto', 'video', 'gif']
  const mediaType = validTypes.includes(type) ? type : 'all'

  let session = await getSession()
  const collected = []
  const seen = new Set()
  let bookmark = null
  let page = 0

  while (page < 4 && collected.length < maxLimit) {
    page++
    if (page > 1) await sleep(800)

    let rr
    try {
      rr = await fetchPage(session, query, bookmark)
    } catch (err) {
      if (/HTTP 403|Invalid Resource Request|failure/i.test(err.message)) {
        session = await getSession(true)
        rr = await fetchPage(session, query, bookmark)
      } else {
        throw err
      }
    }

    const results = (rr.data && rr.data.results) || []
    if (!results.length) break

    for (const raw of results) {
      if (raw.type !== 'pin') continue
      if (collected.length >= maxLimit) break
      const id = String(raw.id)
      if (seen.has(id)) continue
      seen.add(id)
      const mapped = mapPin(raw)
      if (mediaType !== 'all' && mapped.media_type !== mediaType) continue
      if (!mapped.media_url) continue
      collected.push(mapped)
    }

    bookmark = rr.bookmark || null
    if (!bookmark) break
  }

  return {
    query,
    type: mediaType,
    total: collected.length,
    results: collected,
  }
}

export default { searchPinterest }

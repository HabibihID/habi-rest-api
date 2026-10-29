// GetDL — Mesin cadangan AIO downloader via getdl.space untuk HABI REST API.
// Diadaptasi dari GetDL scraper (Razeerh) atas kiriman user 2026-10-21.
// Dipakai lib/downloaders/aio.js sebagai fallback bila mesin utama gagal/kosong.
// Mengembalikan bentuk data yang sama dengan aioDl: { title, platform, thumbnail, medias }.
import axios from 'axios'

const SITE = 'https://getdl.space'
const HOME = `${SITE}/en`
const UA = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const client = axios.create({
  timeout: 25000,
  maxRedirects: 5,
  headers: {
    'User-Agent': UA,
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  },
})

function normalizeUrl(u) {
  if (typeof u !== 'string' || !u) return u
  return u.replace(/\\u002f/gi, '/').replace(/\\\//g, '/').trim()
}

async function createSession() {
  const res = await client.get(`${SITE}/api/session`, {
    timeout: 15000,
    headers: { Referer: HOME, Origin: SITE },
  })
  const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  if (!body || !body.success || !body.sessionId) {
    const e = new Error('Gagal membuat sesi di getdl.space')
    e.code = 'SESSION_CREATE_FAILED'
    throw e
  }
  const setCookie = res.headers['set-cookie'] || []
  const raw = setCookie.find((c) => /^getdl_sid=/i.test(c)) || ''
  const cookie = raw.split(';')[0]
  if (!cookie) {
    const e = new Error('Cookie getdl_sid tidak diterima dari server')
    e.code = 'NO_COOKIE'
    throw e
  }
  return { sessionId: body.sessionId, cookie }
}

async function resolveOnce(targetUrl, session) {
  const res = await client.post(
    `${SITE}/api/download`,
    { url: targetUrl, sessionId: session.sessionId },
    {
      timeout: 60000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        Origin: SITE,
        Referer: HOME,
        Cookie: session.cookie,
      },
    }
  )
  let body = res.data
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  return { status: res.status, body }
}

function typeFromExt(ext) {
  const e = String(ext || '').toLowerCase()
  if (['mp4', 'webm', 'mov', 'mkv'].includes(e)) return 'video'
  if (['mp3', 'm4a', 'ogg', 'wav', 'opus'].includes(e)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) return 'image'
  return 'media'
}

/**
 * Resolve satu URL konten via GetDL.
 * Return { title, platform, thumbnail, medias: [{label,url,quality,type,ext}] }.
 */
export async function getdlDl(targetUrl) {
  if (!targetUrl) throw new Error('URL wajib diisi')

  let session = await createSession()
  let refreshed = 0
  let rateRetried = false

  for (;;) {
    const { status, body } = await resolveOnce(targetUrl, session)

    if (body && body.success && body.data) {
      const data = body.data
      const medias = (Array.isArray(data.downloads) ? data.downloads : [])
        .filter((d) => d && d.url)
        .map((d) => ({
          label: d.label || 'Media',
          url: normalizeUrl(d.url),
          quality: d.quality || 'Default',
          type: typeFromExt(d.ext),
          ext: d.ext || 'mp4',
        }))
      if (!medias.length) throw new Error('GetDL: tidak ada media ditemukan')
      return {
        title: data.title || 'Tanpa Judul',
        platform: data.platform || 'Unknown',
        thumbnail: data.thumbnail || null,
        medias,
      }
    }

    const code = (body && body.code) || `HTTP_${status}`

    if (code === 'SESSION_REQUIRED' && refreshed < 2) {
      refreshed++
      session = await createSession()
      continue
    }

    if (code === 'RATE_LIMITED' && !rateRetried) {
      rateRetried = true
      await sleep(8000)
      continue
    }

    throw new Error(`GetDL: ${(body && body.error) || `Permintaan gagal (${code}, HTTP ${status})`}`)
  }
}

export default { getdlDl }

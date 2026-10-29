// lib/downloaders/snackvideo.js — SnackVideo downloader (HABI REST API)
// Ditulis dari nol: ambil halaman tontonan publik SnackVideo/Kwai, ekstrak
// URL video dari metadata halaman (og:video / JSON tertanam). Tanpa login,
// tanpa API pihak ketiga, tanpa bypass anti-bot — halaman gagal dibaca /
// video tidak ditemukan -> error JSON yang jelas.

import https from 'node:https'

const UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

function httpsGet(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects <= 0) return reject(new Error('Terlalu banyak redirect'))
        const next = new URL(res.headers.location, url).toString()
        return resolve(httpsGet(next, redirects - 1))
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)) }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), finalUrl: url }))
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout mengambil halaman')) })
  })
}

function unescapeStr(s = '') {
  return s.replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&')
}

function metaContent(html, prop) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re1) || html.match(re2)
  return m ? unescapeStr(m[1]) : ''
}

function jsonField(html, keys) {
  for (const k of keys) {
    const m = html.match(new RegExp(`"${k}"\\s*:\\s*"([^"]+)"`))
    if (m && m[1]) return unescapeStr(m[1])
    const arr = html.match(new RegExp(`"${k}"\\s*:\\s*\\[\\s*"([^"]+)"`))
    if (arr && arr[1]) return unescapeStr(arr[1])
  }
  return ''
}

/** Ekstrak data video dari HTML halaman SnackVideo. Diekspor untuk pengujian. */
export function parseSnackHtml(html = '') {
  const videoUrl =
    metaContent(html, 'og:video:secure_url') ||
    metaContent(html, 'og:video:url') ||
    metaContent(html, 'og:video') ||
    metaContent(html, 'twitter:player:stream') ||
    jsonField(html, ['photoUrl', 'playUrl', 'videoUrl', 'mainMvUrls', 'src'])
  const cover = metaContent(html, 'og:image') || jsonField(html, ['coverUrl', 'thumbnailUrl'])
  const title = metaContent(html, 'og:title') || metaContent(html, 'twitter:title')
  const author = jsonField(html, ['userName', 'name'])
  if (!videoUrl || !/\.mp4|video/i.test(videoUrl)) return null
  return { videoUrl, cover, title, author }
}

export async function snackDl(rawUrl) {
  let u
  try { u = new URL(String(rawUrl || '')) } catch { throw new Error('URL tidak valid') }
  if (!/(^|\.)(snackvideo\.com|kwai\.com)$/i.test(u.hostname)) {
    throw new Error('Link bukan SnackVideo — kirim link snackvideo.com')
  }
  const { html } = await httpsGet(u.toString())
  const data = parseSnackHtml(html)
  if (!data) throw new Error('Video tidak ditemukan di halaman — link mungkin privat, sudah dihapus, atau formatnya berubah')
  return { status: true, result: { ...data, source: u.toString() } }
}

export default snackDl

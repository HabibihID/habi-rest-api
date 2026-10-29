// lib/downloaders/soundcloud.js — SoundCloud downloader (HABI REST API)
// Ditulis dari nol, tanpa API pihak ketiga & tanpa login:
//  1. Ambil halaman track publik -> __sc_hydration (id, judul, authorization).
//  2. client_id publik dari aset JS resmi SoundCloud (di-cache).
//  3. Daftar transcoding dari api-v2 /tracks/{id}.
//  4. Unduh: stream HLS (atau progressive bila ada) di-mux jadi MP3
//     dengan ffmpeg lokal — pola sama seperti /api/ytdl.
//
// Catatan: sebagian lagu label besar ber-policy BLOCK dari SoundCloud
// (transcoding kosong untuk akses anonim) -> error yang jelas.

import https from 'node:https'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const MAX_DURATION_SEC = 20 * 60
let cachedClientId = ''

function httpsGet(url, { json = false, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': UA, 'Accept': json ? 'application/json' : 'text/html,*/*' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects <= 0) return reject(new Error('Terlalu banyak redirect'))
        return resolve(httpsGet(new URL(res.headers.location, url).toString(), { json, redirects: redirects - 1 }))
      }
      if (res.statusCode === 404) { res.resume(); return reject(new Error('HTTP 404')) }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)) }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (!json) return resolve(text)
        try { resolve(JSON.parse(text)) } catch { reject(new Error('Respons SoundCloud tidak valid')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout mengambil data SoundCloud')) })
  })
}

/** Ekstrak objek track dari __sc_hydration. Diekspor untuk pengujian. */
export function parseTrackHydration(html = '') {
  const m = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/)
  if (!m) return null
  let arr
  try { arr = JSON.parse(m[1]) } catch { return null }
  for (const entry of arr) {
    const d = entry?.data
    if (d && d.media && d.title && d.id) return d
  }
  return null
}

async function getClientId(html) {
  if (cachedClientId) return cachedClientId
  const assets = [...new Set([...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[0-9]+-[a-z0-9]+\.js/g)].map((x) => x[0]))]
  for (const asset of assets.slice(0, 12)) {
    try {
      const js = await httpsGet(asset)
      const m = js.match(/client_id["']?\s*[:=]\s*["']([a-zA-Z0-9]{16,40})["']/) || js.match(/"client_id","([a-zA-Z0-9]{16,40})"/)
      if (m) { cachedClientId = m[1]; return cachedClientId }
    } catch { /* coba aset berikutnya */ }
  }
  throw new Error('client_id SoundCloud tidak ditemukan (struktur halaman berubah)')
}

async function resolveTrack(rawUrl) {
  let u
  try { u = new URL(String(rawUrl || '')) } catch { throw new Error('URL tidak valid') }
  if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) {
    throw new Error('Link bukan SoundCloud — kirim link soundcloud.com')
  }
  const html = await httpsGet(u.toString())
  const page = parseTrackHydration(html)
  if (!page) throw new Error('Track tidak ditemukan — link mungkin salah, privat, atau bukan halaman lagu')
  const clientId = await getClientId(html)
  const detail = await httpsGet(`https://api-v2.soundcloud.com/tracks/${page.id}?client_id=${clientId}`, { json: true }).catch(() => page)
  const transcodings = detail?.media?.transcodings || page.media?.transcodings || []
  if (!transcodings.length) {
    throw new Error('Lagu ini tidak menyediakan stream untuk publik (kebijakan label di SoundCloud) — coba lagu lain')
  }
  const pick =
    transcodings.find((t) => t.format?.protocol === 'progressive') ||
    transcodings.find((t) => t.format?.protocol === 'hls' && /aac_160k/.test(t.preset || '')) ||
    transcodings.find((t) => t.format?.protocol === 'hls')
  if (!pick) throw new Error('Stream untuk lagu ini tidak tersedia')
  const sep = pick.url.includes('?') ? '&' : '?'
  const auth = page.track_authorization ? `&track_authorization=${encodeURIComponent(page.track_authorization)}` : ''
  const resolved = await httpsGet(`${pick.url}${sep}client_id=${clientId}${auth}`, { json: true })
  if (!resolved?.url) throw new Error('Gagal meresolusi URL stream SoundCloud')
  return {
    title: page.title || '',
    artist: page.user?.username || '',
    duration: Math.round((page.duration || 0) / 1000),
    artwork: (page.artwork_url || '').replace('-large', '-t500x500') || null,
    streamUrl: resolved.url,
    protocol: pick.format?.protocol || '',
    source: u.toString(),
  }
}

export async function soundcloudDl(rawUrl) {
  const r = await resolveTrack(rawUrl)
  return { status: true, result: r }
}

export async function soundcloudDownload(rawUrl) {
  const r = await resolveTrack(rawUrl)
  if (r.duration > MAX_DURATION_SEC) {
    throw new Error(`Lagu terlalu panjang (${Math.round(r.duration / 60)} menit) — batas unduh ${MAX_DURATION_SEC / 60} menit`)
  }
  const tmp = path.join(os.tmpdir(), `sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`)
  await new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-i', r.streamUrl, '-vn', '-codec:a', 'libmp3lame', '-q:a', '4', tmp],
      { timeout: 300000 }, (err) => (err ? reject(new Error('ffmpeg gagal mengunduh stream: ' + err.message)) : resolve()))
  })
  const stat = fs.statSync(tmp)
  if (!stat.size) { try { fs.unlinkSync(tmp) } catch {} ; throw new Error('Hasil unduhan kosong') }
  const safeName = (r.title || 'soundcloud').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'soundcloud'
  return {
    filePath: tmp,
    mimetype: 'audio/mpeg',
    fileName: safeName + '.mp3',
    title: r.title,
    artist: r.artist,
    duration: r.duration,
    size: stat.size,
    cleanup: () => { try { fs.unlinkSync(tmp) } catch {} },
  }
}

export default soundcloudDl

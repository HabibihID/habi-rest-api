// lib/downloaders/terabox.js — Resolver link share Terabox (alur web publik,
// TANPA login / TANPA akun / TANPA bypass CAPTCHA).
// Untuk endpoint GET /api/terabox/list & /api/terabox/download.
// Ditulis untuk HABI REST API.
//
// Alur (sama seperti browser membuka link share publik):
//  1. Buka halaman share -> server Terabox memberi cookie sesi tamu +
//     jsToken/sign/timestamp tertanam di HTML.
//  2. GET /share/list?shorturl=... -> daftar file (nama, ukuran, dlink).
//  3. Unduh = GET dlink dengan cookie sesi yang sama (di-stream ke klien).
// Bila Terabox meminta login/verifikasi, fungsi melempar error yang jelas.

import https from 'node:https'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const API_HOST = 'www.teraboxapp.com'
const MAX_DOWNLOAD = 500 * 1024 * 1024

function rawRequest(urlStr, { cookies = '', referer = '', timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      family: 4,
      timeout: timeoutMs,
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        ...(cookies ? { Cookie: cookies } : {}),
        ...(referer ? { Referer: referer } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('timeout', () => req.destroy(new Error('Timeout ke Terabox')))
    req.on('error', reject)
  })
}

function mergeCookies(jar, setCookie) {
  if (!setCookie) return jar
  const map = new Map()
  for (const part of jar.split('; ').filter(Boolean)) {
    const i = part.indexOf('=')
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1))
  }
  for (const sc of Array.isArray(setCookie) ? setCookie : [setCookie]) {
    const first = String(sc).split(';')[0]
    const i = first.indexOf('=')
    if (i > 0) map.set(first.slice(0, i).trim(), first.slice(i + 1).trim())
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

export function extractSurl(input) {
  const s = String(input || '').trim()
  const m = s.match(/\/s\/([A-Za-z0-9_\-]+)/) || s.match(/[?&]surl=([A-Za-z0-9_\-]+)/)
  if (m) return m[1]
  if (/^[A-Za-z0-9_\-]{10,}$/.test(s)) return s
  return null
}

const sessions = new Map() // surl -> { at, cookies, jsToken, sign, timestamp }
const SESSION_TTL = 20 * 60 * 1000

// Halaman share me-redirect ke mirror regional (mis. 1024terabox.com) —
// ikuti redirect-nya, gabungkan cookie di setiap lompatan, catat host akhir.
async function fetchPageFollow(startUrl) {
  let url = startUrl
  let cookies = ''
  for (let hop = 0; hop < 6; hop++) {
    const r = await rawRequest(url, { cookies })
    cookies = mergeCookies(cookies, r.headers['set-cookie'])
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      url = new URL(r.headers.location, url).toString()
      continue
    }
    return { ...r, cookies, finalUrl: url }
  }
  throw new Error('Terlalu banyak redirect dari Terabox.')
}

async function getSession(surl) {
  const hit = sessions.get(surl)
  if (hit && Date.now() - hit.at < SESSION_TTL) return hit

  const r = await fetchPageFollow(`https://${API_HOST}/s/${surl}`)
  if (r.status >= 400) throw new Error(`Terabox menolak halaman share (HTTP ${r.status}). Link mungkin mati.`)
  if (/\/error\/404/.test(r.finalUrl)) throw new Error('Link Terabox tidak valid / sudah kedaluwarsa.')
  const html = r.body.toString('utf8')
  if (/captcha|verify/i.test(html) && !html.includes('jsToken')) {
    throw new Error('Terabox meminta verifikasi (CAPTCHA) untuk IP server — tidak bisa dilanjutkan tanpa login.')
  }
  const pick = (re) => (html.match(re) || [])[1] || ''
  const jsToken = pick(/"jsToken"\s*:\s*"([^"]+)"/) || pick(/jsToken[=:"']+\s*"?([A-Za-z0-9._\-]{8,})/)
  const sign = pick(/"sign"\s*:\s*"([^"]+)"/)
  const timestamp = pick(/"timestamp"\s*:\s*"?(\d{9,})"?/)
  if (!jsToken) throw new Error('jsToken Terabox tidak ditemukan — format halaman berubah atau link butuh login.')
  const sess = {
    at: Date.now(), cookies: r.cookies, jsToken, sign, timestamp,
    pageUrl: r.finalUrl, host: new URL(r.finalUrl).hostname,
  }
  sessions.set(surl, sess)
  if (sessions.size > 100) sessions.clear()
  return sess
}

async function shareList(sess, surl, dir = '') {
  const q = new URLSearchParams({
    app_id: '250528', web: '1', channel: 'chunlei', clienttype: '0',
    jsToken: sess.jsToken, shorturl: surl, root: dir ? '0' : '1',
    page: '1', num: '100', order: 'name',
    ...(dir ? { dir } : {}),
  })
  const r = await rawRequest(`https://${sess.host || API_HOST}/share/list?${q}`, { cookies: sess.cookies, referer: sess.pageUrl })
  let j
  try { j = JSON.parse(r.body.toString('utf8')) } catch {
    throw new Error('Terabox membalas non-JSON (kemungkinan halaman verifikasi/login).')
  }
  if (j.errno !== 0) {
    if (j.errno === -9 || j.errno === 2) throw new Error('Link Terabox tidak valid / sudah kedaluwarsa.')
    throw new Error(`Terabox error ${j.errno}${j.errmsg ? ': ' + j.errmsg : ''}`)
  }
  return (j.list || []).map((f) => ({
    fsid: String(f.fs_id),
    name: f.server_filename,
    size: Number(f.size) || 0,
    isdir: Number(f.isdir) === 1,
    path: f.path || '',
    dlink: f.dlink || '',
  }))
}

export async function teraboxList(input) {
  const surl = extractSurl(input)
  if (!surl) throw new Error('Link Terabox tidak valid. Kirim link share-nya (mengandung /s/...).')
  const sess = await getSession(surl)
  const root = await shareList(sess, surl)
  // Sertakan isi 1 level subfolder supaya plugin bisa memilih file di dalamnya.
  const files = []
  for (const item of root) {
    if (item.isdir) {
      try {
        const sub = await shareList(sess, surl, item.path)
        for (const s of sub) if (!s.isdir) files.push({ ...s, folder: item.name })
      } catch { /* subfolder gagal: lewati */ }
    } else files.push(item)
  }
  return { surl, files }
}

export async function teraboxDownloadStream(input, fsid, res) {
  const { surl, files } = await teraboxList(input)
  const file = files.find((f) => f.fsid === String(fsid))
  if (!file) throw new Error('File tidak ditemukan di dalam link share itu.')
  if (!file.dlink) throw new Error('Link unduh langsung tidak tersedia untuk file ini (Terabox membatasinya).')
  if (file.size > MAX_DOWNLOAD) throw new Error('File terlalu besar (>500MB) untuk diunduh lewat API.')

  const sess = await getSession(surl)
  // dlink biasanya redirect ke CDN — ikuti maksimal 3x sambil meneruskan cookie.
  let url = file.dlink
  for (let hop = 0; hop < 4; hop++) {
    const r = await new Promise((resolve, reject) => {
      const u = new URL(url)
      const req = https.get({
        hostname: u.hostname, path: u.pathname + u.search, family: 4, timeout: 30000,
        headers: { 'User-Agent': UA, ...(sess.cookies ? { Cookie: sess.cookies } : {}) },
      }, resolve)
      req.on('timeout', () => req.destroy(new Error('Timeout unduh Terabox')))
      req.on('error', reject)
    })
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      r.resume()
      url = r.headers.location
      continue
    }
    if (r.statusCode !== 200) { r.resume(); throw new Error(`CDN Terabox HTTP ${r.statusCode}`) }
    res.setHeader('Content-Type', r.headers['content-type'] || 'application/octet-stream')
    if (r.headers['content-length']) res.setHeader('Content-Length', r.headers['content-length'])
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    r.pipe(res)
    return file
  }
  throw new Error('Terlalu banyak redirect dari Terabox.')
}

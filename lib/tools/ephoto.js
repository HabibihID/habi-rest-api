// Ephoto — efek teks aesthetic via ephoto360.com (scrape, gratis).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/ephoto?effect=glitch&text=HABI -> gambar (image/jpeg)
// Efek tersedia: glitch, neon, tigercub
//
// Catatan: ephoto360 kadang memblokir request otomatis / mengubah struktur.
// Endpoint mengembalikan error yang jelas jika upstream gagal.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const EFFECTS = {
  glitch: 'https://ephoto360.com/glitch-text-on-dark-background-566.html',
  neon: 'https://ephoto360.com/neon-light-text-effect-online-882.html',
  tigercub: 'https://ephoto360.com/tiger-cub-logo-maker-1068.html',
}

export function ephotoEffects() {
  return Object.keys(EFFECTS)
}

async function fetchTimeout(url, opts = {}, ms = 30000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

function extractHidden(html, name) {
  const m = html.match(new RegExp(`name="${name}" value="([^"]*)"`))
  return m ? m[1] : ''
}

export async function ephoto(effect, text) {
  effect = String(effect || '').trim().toLowerCase()
  text = String(text || '').trim()
  if (!EFFECTS[effect]) {
    throw new Error(`Efek tidak dikenal. Pilihan: ${Object.keys(EFFECTS).join(', ')}`)
  }
  if (!text) throw new Error('Parameter ?text= wajib diisi.')
  if (text.length > 30) text = text.slice(0, 30)

  const pageUrl = EFFECTS[effect]

  // 1. GET halaman efek (ambil token + build_server), simpan cookie
  const cookieJar = {}
  const r1 = await fetchTimeout(pageUrl, { headers: { 'User-Agent': UA } })
  if (!r1.ok) throw new Error(`Ephoto360 HTTP ${r1.status}`)
  const setCookie = r1.headers.get('set-cookie')
  if (setCookie) {
    for (const part of setCookie.split(',')) {
      const kv = part.split(';')[0].trim().split('=')
      if (kv.length === 2) cookieJar[kv[0]] = kv[1]
    }
  }
  const html = await r1.text()
  const token = extractHidden(html, 'token')
  const buildServer = extractHidden(html, 'build_server')
  const buildServerId = extractHidden(html, 'build_server_id') || '1'
  if (!token) throw new Error('Gagal baca token ephoto360 (struktur berubah?).')

  // 2. POST create-image
  const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
  const body = new URLSearchParams()
  body.append('text[]', text)
  body.append('token', token)
  body.append('build_server', buildServer)
  body.append('build_server_id', buildServerId)

  const r2 = await fetchTimeout('https://ephoto360.com/effect/create-image', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: pageUrl,
      Cookie: cookieStr,
    },
    body: body.toString(),
  }, 90000)
  const j = await r2.json().catch(() => null)
  if (!j?.success) {
    throw new Error(`Ephoto360 gagal: ${j?.info || 'upstream error'} (mungkin diblokir, coba lagi nanti)`)
  }

  // 3. Download gambar hasil
  const imgUrl = j.fullsize_image || j.image_url || j.image
  if (!imgUrl) throw new Error('Ephoto360 tidak mengembalikan URL gambar.')
  const r3 = await fetchTimeout(imgUrl, { headers: { 'User-Agent': UA } }, 60000)
  if (!r3.ok) throw new Error(`Gagal unduh gambar: HTTP ${r3.status}`)
  const buf = Buffer.from(await r3.arrayBuffer())
  if (!buf.length) throw new Error('Gambar kosong.')
  return { buffer: buf, mime: r3.headers.get('content-type') || 'image/jpeg' }
}

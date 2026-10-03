import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// Fetch via curl (bypass Cloudflare TLS fingerprint block terhadap Node fetch)
async function curlJson(url, headers = {}) {
  const args = ['-s', '--max-time', '25', url]
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 })
  return JSON.parse(stdout)
}

async function curlText(url, headers = {}) {
  const args = ['-sL', '--max-time', '30', url]
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

const GENIUS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json'
}

// === LaguDaerah.com — khusus lagu daerah Indonesia (Batak, Jawa, Sunda, dll) ===
async function laguDaerahSearch(query) {
  const q = encodeURIComponent(query)
  const html = await curlText(`https://lagudaerah.com/?s=${q}`, {
    'User-Agent': GENIUS_HEADERS['User-Agent']
  })
  // Cari link artikel lagu
  const links = [...html.matchAll(/<a[^>]*href="(https:\/\/lagudaerah\.com\/(?!en\/\?s=|tag\/|category\/)[^"]+)"[^>]*>([^<]{5,80})/g)]
  for (const m of links) {
    const url = m[1], title = m[2].trim()
    // Skip halaman navigasi
    if (/^https:\/\/lagudaerah\.com\/?$/.test(url)) continue
    if (url.includes('?s=')) continue
    return { url, title }
  }
  throw new Error('lagudaerah no hit')
}

async function laguDaerahScrape(url) {
  const html = await curlText(url, { 'User-Agent': GENIUS_HEADERS['User-Agent'] })
  // Ambil dari <pre> blocks (lirik bersih)
  const pres = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)]
  let best = ''
  for (const m of pres) {
    let text = m[1].replace(/<[^>]+>/g, '').replace(/&#91;/g, '[').replace(/&#93;/g, ']').trim()
    // Skip yang isinya chord (banyak huruf kapital tunggal)
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 4) continue
    // Ambil yang paling panjang (lirik, bukan chord)
    if (text.length > best.length) best = text
  }
  if (best.length < 50) throw new Error('lagudaerah empty')
  // Bersihkan terjemahan Inggris (ambil baris Batak saja - baris ganjil biasanya asli)
  // Untuk sekarang kembalikan semua, bot yang potong
  return best
}

async function lyricsOvh(artist, title) {
  const r = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' } }
  )
  if (!r.ok) throw new Error('ovh miss')
  const j = await r.json()
  if (!j?.lyrics?.trim()) throw new Error('ovh empty')
  return { lyrics: j.lyrics.trim(), artist, title }
}

async function lyricsOvhSearch(query) {
  const r = await fetch(
    `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' } }
  )
  if (!r.ok) throw new Error('suggest fail')
  const j = await r.json()
  const hits = (j?.data || []).filter(x => x?.title && x?.artist?.name).slice(0, 5)
  if (!hits.length) throw new Error('no hits')
  // Coba satu per satu sampai dapat lirik
  for (const h of hits) {
    try {
      const res = await lyricsOvh(h.artist.name, h.title)
      return res
    } catch {}
  }
  throw new Error('no lyrics from hits')
}

async function geniusSearch(artist, title) {
  const key = process.env.GENIUS_KEY
  if (!key) throw new Error('no genius key')
  const q = new URLSearchParams({ q: `${artist} ${title}`.trim() })
  const j = await curlJson(`https://api.genius.com/search?${q}`, {
    ...GENIUS_HEADERS,
    'Authorization': `Bearer ${key}`
  })
  const hit = j?.response?.hits?.[0]?.result
  if (!hit?.url) throw new Error('genius no hit')
  return hit.url
}

async function geniusScrape(url) {
  const html = await curlText(url, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  // Ekstrak container dengan hitung kedalaman div (nested div safe)
  const containers = []
  const openRe = /<div[^>]*data-lyrics-container[^>]*>/g
  let m
  while ((m = openRe.exec(html)) !== null) {
    let depth = 1, pos = m.index + m[0].length
    const divOpen = /<div[^>]*>/g, divClose = /<\/div>/g
    while (depth > 0 && pos < html.length) {
      divOpen.lastIndex = pos; divClose.lastIndex = pos
      const o = divOpen.exec(html), c = divClose.exec(html)
      if (!c) break
      if (o && o.index < c.index) { depth++; pos = o.index + o[0].length }
      else {
        depth--
        if (depth === 0) { containers.push(html.slice(m.index + m[0].length, c.index)); break }
        pos = c.index + c[0].length
      }
    }
  }
  if (!containers.length) throw new Error('genius parse fail')

  let text = containers.join('\n')
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\[.*?\]/g, '').trim()
  // Buang header "Contributors...Lyrics" kalau ada
  text = text.replace(/^\d*\s*Contributors.*?Lyrics/i, '').trim()
  if (text.length < 50) throw new Error('genius empty')
  return text
}

export async function lirik(artist, title) {
  const isSearch = !artist || artist === '_search_'
  const query = isSearch ? title : `${artist} ${title}`

  // Mode search: coba lyrics.ovh suggest dulu
  if (isSearch) {
    try {
      const res = await lyricsOvhSearch(title)
      return { artist: res.artist, title: res.title, lyrics: res.lyrics, source: 'lyrics.ovh/search' }
    } catch {}
    // Coba Genius (1x search, pakai ulang hasilnya)
    try {
      const hit = await geniusBestHit(query)
      try {
        const lyrics = await geniusScrape(hit.url)
        return { artist: hit.artist, title: hit.title, lyrics, source: 'genius' }
      } catch {
        // Scrape 403 (IP VPS diblokir) → kasih URL ke bot untuk scrape langsung
        return { artist: hit.artist, title: hit.title, lyrics: null, source: 'genius', geniusUrl: hit.url, needScrape: true }
      }
    } catch {}
    // Fallback: lagu daerah Indonesia (Batak, Jawa, Sunda, dll)
    try {
      const hit = await laguDaerahSearch(query)
      const lyrics = await laguDaerahScrape(hit.url)
      return { artist: 'Lagu Daerah', title: hit.title, lyrics, source: 'lagudaerah' }
    } catch {}
    throw new Error('Lirik tidak ditemukan. Coba judul yang lebih tepat.')
  }

  // Mode artist|title: coba lyrics.ovh dulu (cepat, gratis)
  try {
    const res = await lyricsOvh(artist, title)
    return { artist: res.artist, title: res.title, lyrics: res.lyrics, source: 'lyrics.ovh' }
  } catch {}

  // Fallback: search by combined query
  try {
    const res = await lyricsOvhSearch(query)
    return { artist: res.artist, title: res.title, lyrics: res.lyrics, source: 'lyrics.ovh/search' }
  } catch {}

  // Fallback ke Genius (kalau ada key)
  try {
    const url = await geniusSearch(artist, title)
    const lyrics = await geniusScrape(url)
    return { artist, title, lyrics, source: 'genius' }
  } catch (e) {
    throw new Error('Lirik tidak ditemukan. Coba judul yang lebih tepat.')
  }
}

async function geniusBestHit(query) {
  const key = process.env.GENIUS_KEY
  const q = new URLSearchParams({ q: query })
  const j = await curlJson(`https://api.genius.com/search?${q}`, {
    ...GENIUS_HEADERS,
    'Authorization': `Bearer ${key}`
  })
  const hit = j?.response?.hits?.[0]?.result
  if (!hit) throw new Error('no hit')
  return {
    title: hit.title || query,
    artist: hit.primary_artist?.name || 'Unknown',
    url: hit.url
  }
}

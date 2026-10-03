// Lirik lagu — multi-source
// Primary: lyrics.ovh (gratis, bagus untuk lagu Barat)
// Secondary: Genius API (butuh GENIUS_KEY, bagus untuk semua termasuk Indo)

async function lyricsOvh(artist, title) {
  const r = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!r.ok) throw new Error('ovh miss')
  const j = await r.json()
  if (!j?.lyrics?.trim()) throw new Error('ovh empty')
  return { lyrics: j.lyrics.trim(), artist, title }
}

async function lyricsOvhSearch(query) {
  const r = await fetch(
    `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
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
  const q = new URLSearchParams({ q: `${artist} ${title}` })
  const r = await fetch(`https://api.genius.com/search?${q}`, {
    headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Mozilla/5.0' }
  })
  if (!r.ok) throw new Error('genius search fail')
  const j = await r.json()
  const hit = j?.response?.hits?.[0]?.result
  if (!hit?.url) throw new Error('genius no hit')
  return hit.url
}

async function geniusScrape(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
  const html = await r.text()
  // Genius pakai div dengan data-lyrics-container
  const matches = [...html.matchAll(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/g)]
  if (!matches.length) throw new Error('genius parse fail')
  let text = matches.map(m => m[1]).join('\n')
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim()
  if (text.length < 50) throw new Error('genius empty')
  return text
}

export async function lirik(artist, title) {
  // Kalau cuma query (tanpa artist jelas), pakai search
  if (!artist || artist === '_search_') {
    try {
      const res = await lyricsOvhSearch(title)
      return { artist: res.artist, title: res.title, lyrics: res.lyrics, source: 'lyrics.ovh/search' }
    } catch {}
  }

  // Coba lyrics.ovh dulu (cepat, gratis)
  try {
    const res = await lyricsOvh(artist, title)
    return { artist: res.artist, title: res.title, lyrics: res.lyrics, source: 'lyrics.ovh' }
  } catch {}

  // Fallback: search by combined query
  try {
    const res = await lyricsOvhSearch(`${artist} ${title}`)
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

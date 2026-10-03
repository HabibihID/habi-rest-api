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
  const q = new URLSearchParams({ q: `${artist} ${title}`.trim() })
  // Retry 3x karena Genius kadang return HTML (intermittent block)
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.genius.com/search?${q}`, {
        headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Mozilla/5.0' }
      })
      const text = await r.text()
      const j = JSON.parse(text)
      const hit = j?.response?.hits?.[0]?.result
      if (!hit?.url) throw new Error('genius no hit')
      return hit.url
    } catch (e) {
      if (i === 2) throw new Error('genius search fail')
      await new Promise(r => setTimeout(r, 1500))
    }
  }
}

async function geniusScrape(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
  const html = await r.text()

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
    // Coba Genius: search via API (jalan), scrape mungkin 403 dari VPS
    try {
      const url = await geniusSearch(query, '')
      try {
        const lyrics = await geniusScrape(url)
        const hit = await geniusBestHit(query)
        return { artist: hit.artist, title: hit.title, lyrics, source: 'genius' }
      } catch {
        // Scrape 403 (IP VPS diblokir) → kasih URL ke bot untuk scrape langsung
        const hit = await geniusBestHit(query)
        return { artist: hit.artist, title: hit.title, lyrics: null, source: 'genius', geniusUrl: url, needScrape: true }
      }
    } catch (e) {
      throw new Error('Lirik tidak ditemukan. Coba judul yang lebih tepat.')
    }
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
  const r = await fetch(`https://api.genius.com/search?${q}`, {
    headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Mozilla/5.0' }
  })
  const j = await r.json()
  const hit = j?.response?.hits?.[0]?.result
  return {
    title: hit?.title || query,
    artist: hit?.primary_artist?.name || 'Unknown'
  }
}

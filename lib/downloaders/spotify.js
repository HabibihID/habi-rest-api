// Spotify downloader — metadata via oEmbed publik (tanpa key),
// audio via pencarian YouTube (tanpa key). Konversi audio dilakukan
// di sisi bot/API YouTube (yt-dlp / ytconvert) memakai youtube_url.

import { ytSearch } from './ytsearch.js'
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'spotify'

function extractTrackId(url) {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([a-zA-Z0-9]+)/i)
    || url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?episode\/([a-zA-Z0-9]+)/i)
  return m ? m[1] : null
}

function ogMeta(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const m = html.match(re)
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : null
}

async function spotifyMeta(inputUrl, trackId) {
  // 1) oEmbed publik (cepat bila tidak diblokir)
  try {
    await throttle(PROVIDER, 1000)
    const oe = await httpGet(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(inputUrl)}`,
      { provider: PROVIDER, timeout: 12000, headers: { 'Accept': 'application/json' } }
    )
    if (oe?.title) return { title: oe.title, artist: oe.author_name || null, cover: oe.thumbnail_url || null }
  } catch { /* fallback ke scrape halaman */ }

  // 2) Scrape halaman track (og: meta tags di-render server-side)
  await throttle(PROVIDER, 1000)
  const html = await httpGet(`https://open.spotify.com/track/${trackId}`, {
    provider: PROVIDER,
    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  // og:title format: "Judul lagu, oleh Artis"
  const ogTitle = ogMeta(html, 'og:title')
  const ogDesc = ogMeta(html, 'og:description')
  const ogImage = ogMeta(html, 'og:image')
  if (!ogTitle) throw new Error('Metadata Spotify tidak ditemukan')

  // Parse "Judul, oleh Artis"
  let title = ogTitle, artist = null
  const m = ogTitle.match(/^(.*?),\s*oleh\s+(.+)$/i) || ogTitle.match(/^(.*?)\s*-\s*(.+)$/)
  if (m) { title = m[1].trim(); artist = m[2].trim() }
  else if (ogDesc) {
    const am = ogDesc.match(/(?:Artist|Artis)\s*[·•]\s*([^·•\n]+)/i)
    if (am) artist = am[1].trim()
  }
  return { title, artist, cover: ogImage }
}

export async function spotifyDl(inputUrl) {
  const trackId = extractTrackId(inputUrl)
  if (!trackId) throw new Error('Bukan URL track Spotify')

  const { title, artist, cover } = await spotifyMeta(inputUrl, trackId)

  // 2) Cari padanan di YouTube untuk sumber audio
  let youtube = null
  try {
    const q = [title, artist].filter(Boolean).join(' ')
    const results = await ytSearch(q, 5)
    // Pilih hasil pertama yang relevan (abaikan yang jelas bukan musik bila bisa)
    youtube = results?.results?.[0] || null
  } catch { /* YouTube search gagal — metadata tetap dikembalikan */ }

  return {
    title,
    artist,
    track_id: trackId,
    cover,
    thumbnail: cover,
    spotify_url: `https://open.spotify.com/track/${trackId}`,
    // Sumber audio: video YouTube yang bisa dikonversi ke mp3 via /api/ytmp3 atau yt-dlp
    youtube_url: youtube?.url || null,
    youtube_title: youtube?.title || null,
    youtube_id: youtube?.id || null,
    duration: youtube?.duration || null
  }
}

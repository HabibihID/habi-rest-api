// Lirik lagu — pakai lyrics.ovh (gratis, tanpa key)
export async function lirik(artist, title) {
  const r = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!r.ok) throw new Error('Lirik tidak ditemukan')
  const j = await r.json()
  if (!j?.lyrics) throw new Error('Lirik tidak ditemukan')
  return {
    artist,
    title,
    lyrics: j.lyrics.trim()
  }
}

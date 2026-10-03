// Anime — info anime via Jikan API v4 (data MyAnimeList, gratis tanpa key).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/anime?q=naruto -> { status:true, judul, judul_inggris, gambar, skor, episode, status, sinopsis, url }

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

const UA = { 'User-Agent': 'HABI-REST-API/1.0' }

export async function animeInfo(query) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Parameter ?q= wajib diisi. Contoh: ?q=naruto')

  const r = await fetchTimeout(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1&sfw=true`, { headers: UA })
  if (r.status === 429) throw new Error('Rate limit Jikan, coba lagi sebentar.')
  if (!r.ok) throw new Error(`Jikan HTTP ${r.status}`)
  const j = await r.json()
  const a = j?.data?.[0]
  if (!a) throw new Error(`Anime "${q}" tidak ditemukan.`)

  return {
    judul: a.title || '-',
    judul_inggris: a.title_english || a.title || '-',
    gambar: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    skor: a.score ? String(a.score) : '-',
    episode: a.episodes ? String(a.episodes) : '?',
    status: a.status || '-',
    tipe: a.type || '-',
    tahun: a.aired?.prop?.from?.year ? String(a.aired.prop.from.year) : '-',
    genre: (a.genres || []).map((g) => g.name).slice(0, 5).join(', ') || '-',
    sinopsis: (a.synopsis || 'Tidak ada sinopsis.').slice(0, 800),
    url: a.url || null,
  }
}

// Anime — info anime via AniList GraphQL API (gratis, stabil, tanpa key).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/anime?q=naruto -> { status:true, judul, judul_inggris, gambar, skor, episode, status, sinopsis, url }

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

const UA = { 'User-Agent': 'HABI-REST-API/1.0', 'Content-Type': 'application/json' }

export async function animeInfo(query) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Parameter ?q= wajib diisi. Contoh: ?q=naruto')

  const gql = {
    query: `query ($search: String) {
      Media (search: $search, type: ANIME) {
        title { romaji english native }
        coverImage { large }
        averageScore
        episodes
        status
        format
        startDate { year }
        genres
        description
        siteUrl
      }
    }`,
    variables: { search: q }
  }

  const r = await fetchTimeout('https://graphql.anilist.co', {
    method: 'POST',
    headers: UA,
    body: JSON.stringify(gql)
  })
  if (r.status === 429) throw new Error('Rate limit AniList, coba lagi sebentar.')
  if (!r.ok) throw new Error(`AniList HTTP ${r.status}`)
  const j = await r.json()
  const a = j?.data?.Media
  if (!a) throw new Error(`Anime "${q}" tidak ditemukan.`)

  // Bersihkan HTML dari deskripsi
  const cleanDesc = String(a.description || '').replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim()

  // Translate sinopsis ke Bahasa Indonesia via Workers AI (kalau ada)
  let sinopsis = (cleanDesc || 'Tidak ada sinopsis.').slice(0, 800)
  try {
    if (cleanDesc && /[a-zA-Z]{3,}/.test(cleanDesc)) {
      const tr = await fetchTimeout(
        `https://proxy.servercloud.my.id/proxy?target=cf-ai&prompt=${encodeURIComponent('Terjemahkan ke Bahasa Indonesia dengan singkat (maks 500 karakter): ' + cleanDesc.slice(0, 500))}`,
        {}, 30000
      )
      const tj = await tr.json().catch(() => null)
      if (tj?.status && tj?.result) {
        sinopsis = String(tj.result).slice(0, 800)
      }
    }
  } catch {}

  return {
    judul: a.title?.romaji || '-',
    judul_inggris: a.title?.english || a.title?.romaji || '-',
    gambar: a.coverImage?.large || null,
    skor: a.averageScore ? String(a.averageScore / 10) : '-',
    episode: a.episodes ? String(a.episodes) : '?',
    status: a.status || '-',
    tipe: a.format || '-',
    tahun: a.startDate?.year ? String(a.startDate.year) : '-',
    genre: (a.genres || []).slice(0, 5).join(', ') || '-',
    sinopsis,
    url: a.siteUrl || null,
  }
}

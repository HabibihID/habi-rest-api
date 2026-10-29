// Anime — info anime via AniList GraphQL API (gratis, stabil, tanpa key).
// Ditulis dari nol untuk HABI REST API.
//
// GET /api/anime?q=naruto -> { status:true, judul, judul_inggris, gambar, skor, episode, status, sinopsis, url }

import { httpPost, httpGet } from '../http.js'
import { chatAi } from '../ai/ai.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'anilist'
const UA = { 'User-Agent': 'HABI-REST-API/1.0' }

// POST ke AniList GraphQL dengan throttle + pesan error 429 yang jelas
async function anilistPost(gql) {
  await throttle(PROVIDER, 1000)
  try {
    return await httpPost('https://graphql.anilist.co', gql, { provider: PROVIDER, headers: UA })
  } catch (err) {
    if (err?.status === 429) throw new Error('Rate limit AniList, coba lagi sebentar.')
    throw err
  }
}

// Terjemahkan sinopsis ke Bahasa Indonesia via Workers AI (opsional, gagal = pakai aslinya)
async function translateId(text) {
  try {
    const out = await chatAi('Terjemahkan ke Bahasa Indonesia dengan singkat (maks 500 karakter): ' + text.slice(0, 500))
    if (out) return String(out).slice(0, 800)
  } catch { /* abaikan, pakai sinopsis asli */ }
  return null
}

export async function animeInfo(query) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Parameter ?q= wajib diisi. Contoh: ?q=naruto')

  // Info anime jarang berubah → cache 60 menit
  return cached(`anime:info:${q.toLowerCase()}`, 60 * 60 * 1000, async () => {
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

    const j = await anilistPost(gql)
    const a = j?.data?.Media
    if (!a) throw new Error(`Anime "${q}" tidak ditemukan.`)

    // Bersihkan HTML dari deskripsi
    const cleanDesc = String(a.description || '').replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim()

    let sinopsis = (cleanDesc || 'Tidak ada sinopsis.').slice(0, 800)
    if (cleanDesc && /[a-zA-Z]{3,}/.test(cleanDesc)) {
      sinopsis = (await translateId(cleanDesc)) || sinopsis
    }

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
  })
}

// ── Jadwal tayang anime (7 hari ke depan, dikelompokkan per hari) ──
// GET /api/anime/schedule -> { status:true, days:[{day, date, items:[{time, title, episode}]}] }
export async function animeSchedule() {
  // Jadwal 7 harian → cache 30 menit
  return cached('anime:schedule', 30 * 60 * 1000, async () => {
    const now = Math.floor(Date.now() / 1000)
    const weekEnd = now + 7 * 86400
    const gql = {
      query: `query ($start: Int, $end: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            airingAt
            episode
            media { title { romaji english } siteUrl }
          }
        }
      }`,
      variables: { start: now, end: weekEnd }
    }
    const j = await anilistPost(gql)
    const list = j?.data?.Page?.airingSchedules || []

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const days = {}
    for (const s of list) {
      const d = new Date(s.airingAt * 1000)
      // konversi ke WIB (UTC+7)
      const wib = new Date(d.getTime() + 7 * 3600 * 1000)
      const key = wib.toISOString().slice(0, 10)
      const hhmm = wib.toISOString().slice(11, 16)
      if (!days[key]) days[key] = { day: dayNames[wib.getUTCDay()], date: key, items: [] }
      const t = s.media?.title
      days[key].items.push({
        time: hhmm + ' WIB',
        title: t?.english || t?.romaji || '-',
        episode: s.episode,
        url: s.media?.siteUrl || null,
      })
    }
    return { days: Object.values(days) }
  })
}

// ── Trending & Top anime ──
// GET /api/anime/trending -> { status:true, trending:[], top:[] }
export async function animeTrending() {
  // Daftar trending/top berubah lambat → cache 30 menit
  return cached('anime:trending', 30 * 60 * 1000, async () => {
    const q = (sort) => ({
      query: `query {
        Page(page: 1, perPage: 10) {
          media(sort: ${sort}, type: ANIME) {
            title { romaji english }
            averageScore
            genres
            coverImage { large }
            siteUrl
          }
        }
      }`
    })
    const fmt = (m) => ({
      title: m.title?.english || m.title?.romaji || '-',
      score: m.averageScore ? String(m.averageScore / 10) : '-',
      genres: (m.genres || []).slice(0, 3).join(', '),
      image: m.coverImage?.large || null,
      url: m.siteUrl || null,
    })
    // Throttle sekali sebelum Promise.all agar 2 request tidak menumpuk
    await throttle(PROVIDER, 1000)
    const [tj, pj] = await Promise.all([
      (async () => { try { return await httpPost('https://graphql.anilist.co', q('TRENDING_DESC'), { provider: PROVIDER, headers: UA }) } catch (err) { if (err?.status === 429) throw new Error('Rate limit AniList, coba lagi sebentar.'); throw err } })(),
      (async () => { await throttle(PROVIDER, 1000); try { return await httpPost('https://graphql.anilist.co', q('SCORE_DESC'), { provider: PROVIDER, headers: UA }) } catch (err) { if (err?.status === 429) throw new Error('Rate limit AniList, coba lagi sebentar.'); throw err } })(),
    ])
    return {
      trending: (tj?.data?.Page?.media || []).map(fmt),
      top: (pj?.data?.Page?.media || []).map(fmt),
    }
  })
}

// ── Anime yang sedang tayang (ongoing) ──
// GET /api/anime/ongoing -> { status:true, count, items:[] }
export async function animeOngoing() {
  return cached('anime:ongoing', 30 * 60 * 1000, async () => {
    const gql = {
      query: `query {
        Page(page: 1, perPage: 20) {
          media(status: RELEASING, type: ANIME, sort: TRENDING_DESC) {
            title { romaji english }
            episodes
            averageScore
            genres
            coverImage { large }
            nextAiringEpisode { airingAt episode }
            siteUrl
          }
        }
      }`
    }
    const j = await anilistPost(gql)
    const list = j?.data?.Page?.media || []
    return {
      count: list.length,
      items: list.map((m) => {
        const t = m.title || {}
        const na = m.nextAiringEpisode
        return {
          title: t.english || t.romaji || '-',
          episodes: m.episodes ? String(m.episodes) : '?',
          score: m.averageScore ? String(m.averageScore / 10) : '-',
          genres: (m.genres || []).slice(0, 3).join(', '),
          nextEpisode: na ? `Ep ${na.episode}` : '-',
          image: m.coverImage?.large || null,
          url: m.siteUrl || null,
        }
      }),
    }
  })
}

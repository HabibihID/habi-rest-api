// Komikcast — Search/detail/baca komik dari komikcast.info untuk HABI REST API.
// Diadaptasi dari Komikcast Scraper (Vamz Spectre) atas kiriman user 2026-10-21:
// parsing state Inertia.js (atribut data-page) yang memang disajikan publik
// oleh situsnya. Transport diganti https mentah -> axios (standar backend ini).
import axios from 'axios'

const BASE_URL = 'https://komikcast.info'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function fetchProps(endpoint) {
  const targetUrl = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
  const res = await axios.get(targetUrl, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    },
    responseType: 'text',
    validateStatus: (s) => s === 200,
  }).catch((e) => {
    throw new Error(`Gagal menghubungi Komikcast (HTTP ${e.response?.status || e.message})`)
  })

  const body = typeof res.data === 'string' ? res.data : String(res.data || '')
  const match = body.match(/data-page="([^"]+)"/)
  if (!match) throw new Error('Gagal mengekstrak data-page dari respons Komikcast.')

  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")

  try {
    const pageJson = JSON.parse(decoded)
    return pageJson.props || {}
  } catch (err) {
    throw new Error(`Gagal mem-parsing data Komikcast: ${err.message}`)
  }
}

function mapListItem(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    url: `${BASE_URL}/manga/${item.slug}`,
    poster: item.poster,
    type: item.type,
    status: item.status,
    rating: item.rating,
    release_year: item.release_year,
    author: item.author,
    artist: item.artist,
    genres: (item.genres || []).map((g) => g.name),
    last_chapter: item.last_chapter ? {
      id: item.last_chapter.id,
      title: item.last_chapter.title,
      chapter_number: item.last_chapter.chapter_number,
      url: `${BASE_URL}/manga/${item.slug}/chapter/${item.last_chapter.chapter_number}`,
    } : null,
  }
}

export async function komikSearch(query, page = 1) {
  if (!query) throw new Error('Query pencarian manga tidak boleh kosong.')
  const props = await fetchProps(`/manga?search=${encodeURIComponent(query)}&page=${page}`)
  const mangas = props.mangas || {}
  return {
    query,
    current_page: mangas.current_page || 1,
    last_page: mangas.last_page || 1,
    total_results: mangas.total || (mangas.data || []).length,
    results: (mangas.data || []).map(mapListItem),
  }
}

export async function komikLatest(page = 1) {
  const props = await fetchProps(`/manga?sort=latest&page=${page}`)
  const mangas = props.mangas || {}
  return {
    page: mangas.current_page || 1,
    last_page: mangas.last_page || 1,
    total: mangas.total || (mangas.data || []).length,
    results: (mangas.data || []).map(mapListItem),
  }
}

export async function komikPopular(page = 1) {
  const props = await fetchProps(`/manga?sort=popular&page=${page}`)
  const mangas = props.mangas || {}
  return {
    page: mangas.current_page || 1,
    last_page: mangas.last_page || 1,
    total: mangas.total || (mangas.data || []).length,
    results: (mangas.data || []).map(mapListItem),
  }
}

export async function komikDetail(slugOrUrl) {
  let slug = String(slugOrUrl || '')
  if (slug.includes('/manga/')) {
    const match = slug.match(/\/manga\/([^/?#]+)/)
    if (match) slug = match[1]
  }
  slug = slug.trim().replace(/^\/+|\/+$/g, '')
  if (!slug) throw new Error('Slug manga wajib diisi.')

  const props = await fetchProps(`/manga/${slug}`)
  const m = props.manga
  if (!m) throw new Error(`Manga dengan slug "${slug}" tidak ditemukan.`)

  const chapters = (m.chapters || []).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    chapter_number: c.chapter_number,
    url: `${BASE_URL}/manga/${m.slug}/chapter/${c.chapter_number}`,
    views_count: c.views_count,
    created_at: c.created_at,
  }))

  return {
    id: m.id,
    title: m.title,
    slug: m.slug,
    url: `${BASE_URL}/manga/${m.slug}`,
    poster: m.poster,
    synopsis: m.synopsis,
    type: m.type,
    status: m.status,
    author: m.author,
    artist: m.artist,
    rating: m.rating,
    release_year: m.release_year,
    views_count: m.views_count,
    genres: (m.genres || []).map((g) => ({ name: g.name, slug: g.slug, icon: g.icon })),
    total_chapters: chapters.length,
    first_chapter: props.firstChapter ? {
      chapter_number: props.firstChapter.chapter_number,
      url: `${BASE_URL}/manga/${m.slug}/chapter/${props.firstChapter.chapter_number}`,
    } : null,
    chapters,
  }
}

export async function komikChapter(slugOrUrl, chapterNumber = null) {
  let targetPath = ''

  if (String(slugOrUrl).startsWith('http')) {
    const urlObj = new URL(slugOrUrl)
    targetPath = urlObj.pathname
  } else if (chapterNumber !== null && chapterNumber !== undefined && chapterNumber !== '') {
    targetPath = `/manga/${slugOrUrl}/chapter/${chapterNumber}`
  } else if (String(slugOrUrl).includes('/chapter/')) {
    targetPath = slugOrUrl
  } else {
    throw new Error('Format pemanggilan chapter tidak valid. Gunakan (slug, chapterNumber) atau URL chapter.')
  }

  const props = await fetchProps(targetPath)
  const ch = props.chapter
  const m = props.manga

  if (!ch) throw new Error('Data chapter tidak ditemukan.')

  const images = (ch.images || []).map((img, idx) => ({
    order: img.order !== undefined ? img.order : idx,
    url: img.r2_url || img.image_path,
    bytes: img.r2_bytes || null,
  }))

  return {
    chapter_id: ch.id,
    manga_title: m?.title || null,
    manga_slug: m?.slug || null,
    chapter_title: ch.title,
    chapter_number: ch.chapter_number,
    total_images: images.length,
    navigation: {
      prev: props.prev ? `${BASE_URL}/manga/${m?.slug}/chapter/${props.prev.chapter_number}` : null,
      next: props.next ? `${BASE_URL}/manga/${m?.slug}/chapter/${props.next.chapter_number}` : null,
    },
    images,
  }
}

export default { komikSearch, komikLatest, komikPopular, komikDetail, komikChapter }

// Threads downloader — scrape og: meta tags + oEmbed (tanpa key)
// Threads (Meta) me-render og: meta tags di sisi server, jadi bisa di-scrape langsung.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const m = html.match(re)
  if (m) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i')
  const m2 = html.match(re2)
  return m2 ? m2[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : null
}

async function tryOembed(url) {
  // Endpoint oEmbed Threads (publik, tanpa key)
  for (const base of ['https://www.threads.com/api/oembed', 'https://www.threads.net/api/oembed']) {
    try {
      const r = await fetchTimeout(`${base}?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' }
      })
      if (!r.ok) continue
      const j = await r.json()
      if (j?.html || j?.title) return j
    } catch { /* lanjut */ }
  }
  return null
}

export async function threadsDl(inputUrl) {
  if (!/threads\.(net|com)/i.test(inputUrl)) throw new Error('Bukan URL Threads')

  // Normalisasi: threads.net & threads.com sama-sama valid
  const variants = [inputUrl]
  if (/threads\.net/i.test(inputUrl)) variants.push(inputUrl.replace(/threads\.net/i, 'threads.com'))
  if (/threads\.com/i.test(inputUrl)) variants.push(inputUrl.replace(/threads\.com/i, 'threads.net'))

  let html = null, finalUrl = inputUrl
  for (const u of variants) {
    try {
      const r = await fetchTimeout(u, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      })
      if (r.ok) { html = await r.text(); finalUrl = r.url || u; break }
    } catch { /* coba varian berikutnya */ }
  }
  if (!html) throw new Error('Gagal membuka halaman Threads')

  const video = meta(html, 'og:video') || meta(html, 'og:video:secure_url') || null
  const image = meta(html, 'og:image') || null
  const title = meta(html, 'og:title') || null
  const desc = meta(html, 'og:description') || null

  // oEmbed sebagai pelengkap (author_name dll)
  let author = null
  try {
    const oe = await tryOembed(finalUrl)
    author = oe?.author_name || null
    if (!title && oe?.title) { /* pakai judul oembed */ }
  } catch { /* abaikan */ }

  // Fallback: username dari URL (/ @user /)
  if (!author) {
    const um = inputUrl.match(/threads\.(?:net|com)\/@([^/]+)/i)
    author = um ? um[1] : null
  }

  if (!video && !image) throw new Error('Media tidak ditemukan di post Threads ini')

  return {
    title: title || desc || 'Threads Post',
    author,
    description: desc,
    type: video ? 'video' : 'image',
    video,
    image,
    url: finalUrl
  }
}

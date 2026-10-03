// MediaFire downloader — scrape halaman file untuk direct download link (tanpa key)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function fetchTimeout(url, opts = {}, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

function unescapeJs(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
}

export async function mediafireDl(inputUrl) {
  if (!/mediafire\.com/i.test(inputUrl)) throw new Error('Bukan URL MediaFire')

  const r = await fetchTimeout(inputUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })
  if (!r.ok) throw new Error(`MediaFire HTTP ${r.status}`)
  const html = await r.text()

  if (/error|not found|file has been removed|invalid/i.test(html.slice(0, 2000)) && /removed|deleted|not found/i.test(html))
    throw new Error('File tidak ditemukan / sudah dihapus')

  // 1) Variabel kNO berisi direct link (pola klasik MediaFire)
  let direct = html.match(/kNO\s*=\s*["']([^"']+)["']/)?.[1] || null

  // 2) Tombol download: anchor aria-label="Download file"
  if (!direct) {
    direct = html.match(/aria-label=["']Download file["'][^>]*href=["']([^"']+)["']/i)?.[1]
      || html.match(/href=["']([^"']+)["'][^>]*aria-label=["']Download file["']/i)?.[1]
      || null
  }

  // 3) Pola umum download*.mediafire.com di HTML
  if (!direct) {
    const m = html.match(/https:\/\/download\d*\.mediafire\.com\/[^"'\\\s<>]+/i)
    direct = m ? m[0] : null
  }

  if (direct) direct = unescapeJs(direct).replace(/&amp;/g, '&')
  if (!direct) throw new Error('Direct link tidak ditemukan')

  // Nama file
  let filename = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<div class=["']filename["'][^>]*>([^<]+)</i)?.[1]?.trim()
    || html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim()
    || null
  if (filename) filename = filename.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()

  // Ukuran file
  const size = html.match(/<div class=["']details["'][^>]*>[\s\S]{0,300}?([\d.,]+\s*[KMGT]?B)/i)?.[1]
    || html.match(/File size:?\s*<\/span>\s*([\d.,]+\s*[KMGT]?B)/i)?.[1]
    || html.match(/([\d.,]+\s*[KMGT]B)\s*<\/div>\s*<div class=["']filetype/i)?.[1]
    || null

  return {
    title: filename,
    filename,
    size,
    direct,
    download: direct,
    url: direct,
    source: r.url || inputUrl
  }
}

// Helper HTTP bersama untuk modul stalk.
// Ditulis dari nol untuk HABI REST API. Tanpa API key, tanpa lib pihak ketiga.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function fetchText(url, { timeoutMs = 20000, headers = {} } = {}) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.text()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout (20 detik)')
    throw e
  } finally {
    clearTimeout(t)
  }
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts)
  return JSON.parse(text)
}

// Ambil <meta property/name="..." content="...">
export function meta(html, attr) {
  const re1 = new RegExp(`<meta[^>]+property=["']${attr}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${attr}["']`, 'i')
  const re3 = new RegExp(`<meta[^>]+name=["']${attr}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re4 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${attr}["']`, 'i')
  for (const re of [re1, re2, re3, re4]) {
    const m = html.match(re)
    if (m) return m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  }
  return null
}

export function cleanUsername(u = '') {
  return String(u).trim().replace(/^@/, '').replace(/\/+$/, '')
}

export function num(s) {
  if (s == null) return null
  const n = Number(String(s).replace(/[^0-9]/g, ''))
  return Number.isFinite(n) ? n : null
}

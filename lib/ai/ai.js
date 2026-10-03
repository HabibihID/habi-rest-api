// AI helpers milik HABI REST API.
//
// chatAi(prompt):
//   Text AI via Pollinations Text API — publik & GRATIS, tanpa API key.
//   Bukan API key pihak ketiga; endpoint terbuka untuk umum.
// text2img(prompt):
//   Text-to-image via Pollinations Image API — publik & GRATIS, tanpa API key.
//
// Ditulis dari nol untuk HABI REST API.

async function fetchWithTimeout(url, opts = {}, ms) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: c.signal })
  } finally {
    clearTimeout(t)
  }
}

// Tanya jawab AI (return string) — via Cloudflare Worker proxy
const PROXY_BASE = 'https://proxy.servercloud.my.id/proxy'

export async function chatAi(prompt) {
  prompt = String(prompt || '').trim()
  if (!prompt) throw new Error('Prompt kosong.')
  const url = `${PROXY_BASE}/${encodeURIComponent(prompt)}?target=pollinations-text`
  let lastErr = null
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'HABI-REST-API/1.0' },
      }, 60000)
      if (!r.ok) throw new Error(`Pollinations text HTTP ${r.status}`)
      const text = (await r.text()).trim()
      if (!text) throw new Error('Pollinations mengembalikan teks kosong.')
      return text
    } catch (e) {
      lastErr = e
      // Tunggu sebentar sebelum retry (backoff)
      if (i < 2) await new Promise(r => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw lastErr
}

// Text-to-image (return Buffer gambar) — via Cloudflare Worker proxy
export async function text2img(prompt) {
  prompt = String(prompt || '').trim()
  if (!prompt) throw new Error('Prompt kosong.')
  const url = `${PROXY_BASE}/prompt/${encodeURIComponent(prompt)}?nologo=true&width=768&height=768&target=pollinations-img`
  let lastErr = null
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'HABI-REST-API/1.0' },
      }, 90000)
      if (!r.ok) throw new Error(`Pollinations image HTTP ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      if (!buf.length) throw new Error('Pollinations mengembalikan gambar kosong.')
      return buf
    } catch (e) {
      lastErr = e
      if (i < 2) await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw lastErr
}

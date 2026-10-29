// Meme generator — pakai memegen.link (gratis, tanpa key)
// Template populer: drake, distracted, doge, fry, etc.
// Format: /api/meme/drake?atas=...&bawah=...

import { fetchRetry } from '../http.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

const TEMPLATES = [
  'drake', 'distracted', 'doge', 'fry', 'fry2', 'buzz',
  'spiderman', 'gru', 'rollsafe', 'keanu', 'kermit'
]

const PROVIDER = 'memegen'

export function memeList() {
  return TEMPLATES
}

export async function memeGen(template, atas, bawah) {
  const t = (template || 'drake').toLowerCase()
  if (!TEMPLATES.includes(t)) {
    throw new Error(`Template tidak dikenal. Pilihan: ${TEMPLATES.join(', ')}`)
  }
  const enc = s => encodeURIComponent(s || '_').replace(/%20/g, '_')
  const url = `https://api.memegen.link/images/${t}/${enc(atas)}/${enc(bawah)}.png`

  // Meme bersifat deterministik (template+teks sama = gambar sama) → cache 60 menit
  return cached(`meme:${t}:${enc(atas)}:${enc(bawah)}`, 60 * 60 * 1000, async () => {
    await throttle(PROVIDER, 1000)
    // Butuh binary (Buffer), pakai fetchRetry langsung
    const r = await fetchRetry(url, {}, { provider: PROVIDER, timeout: 30000 })
    if (!r.ok) throw new Error('Gagal generate meme')
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 1000) throw new Error('Meme tidak valid')
    return buf
  })
}

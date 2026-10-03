// Meme generator — pakai memegen.link (gratis, tanpa key)
// Template populer: drake, distracted, doge, fry, etc.
// Format: /api/meme/drake?atas=...&bawah=...

const TEMPLATES = [
  'drake', 'distracted', 'doge', 'fry', 'fry2', 'buzz',
  'spiderman', 'gru', 'rollsafe', 'keanu', 'kermit'
]

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

  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error('Gagal generate meme')
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) throw new Error('Meme tidak valid')
  return buf
}

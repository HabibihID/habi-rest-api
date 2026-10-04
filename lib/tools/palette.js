// /api/palette — Ekstrak warna dominan dari gambar
import sharp from 'sharp'

export async function extractPalette(imageUrl, count = 5) {
  if (!imageUrl) throw new Error('URL gambar wajib diisi')
  count = Math.min(Math.max(parseInt(count) || 5, 1), 10)

  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error('Gagal download gambar')
  const buf = Buffer.from(await res.arrayBuffer())

  // Resize kecil biar cepat, ambil pixel mentah
  const { data, info } = await sharp(buf)
    .resize(50, 50, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Hitung frekuensi warna (quantize ke 32 biar nggak terlalu detail)
  const colorMap = new Map()
  for (let i = 0; i < data.length; i += info.channels) {
    const r = Math.floor(data[i] / 32) * 32
    const g = Math.floor(data[i + 1] / 32) * 32
    const b = Math.floor(data[i + 2] / 32) * 32
    const key = `${r},${g},${b}`
    colorMap.set(key, (colorMap.get(key) || 0) + 1)
  }

  const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, count)
  return sorted.map(([rgb]) => {
    const [r, g, b] = rgb.split(',').map(Number)
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
    return { rgb: `rgb(${r},${g},${b})`, hex }
  })
}

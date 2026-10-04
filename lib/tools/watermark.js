// /api/watermark — Tambah watermark teks ke gambar
import sharp from 'sharp'

export async function addWatermark(imageUrl, text) {
  if (!imageUrl) throw new Error('URL gambar wajib diisi')
  if (!text) throw new Error('Teks watermark wajib diisi')
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error('Gagal download gambar')
  const buf = Buffer.from(await res.arrayBuffer())

  const meta = await sharp(buf).metadata()
  const w = meta.width || 800
  const h = meta.height || 600
  const fontSize = Math.max(20, Math.floor(w / 20))

  const svg = `
  <svg width="${w}" height="${h}">
    <text x="${w - 20}" y="${h - 20}" font-size="${fontSize}" fill="white" fill-opacity="0.7" text-anchor="end" font-family="sans-serif" font-weight="bold">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  </svg>`

  return await sharp(buf)
    .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
    .jpeg({ quality: 90 })
    .toBuffer()
}

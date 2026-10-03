// skinToBlack — ubah warna kulit menjadi hitam pekat.
//
// Cara kerja (100% milik sendiri, pakai sharp):
//   1. Baca gambar → raw RGBA pixel data
//   2. Deteksi piksel kulit dengan 2 aturan (OR):
//      - Aturan RGB: R>95, G>40, B>20, R>G, R>B, |R-G|>15
//      - Aturan YCrCb: Cr 133-173, Cb 77-127
//   3. Piksel kulit → RGB digelapkan drastis (×0.15, mendekati hitam pekat),
//      alpha & shading tetap dipertahankan (bukan flat hitam total).
//   4. Return buffer PNG.
//
// Ditulis dari nol untuk HABI REST API.

import sharp from 'sharp'

const DARKEN = 0.15 // faktor penggelap — makin kecil makin pekat

function rgbToYCrCb(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  return {
    cr: (r - y) * 0.713 + 128,
    cb: (b - y) * 0.564 + 128,
  }
}

function isSkinPixel(r, g, b) {
  // Aturan RGB sederhana
  const rgbRule = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15
  if (rgbRule) return true
  // Aturan YCrCb
  const { cr, cb } = rgbToYCrCb(r, g, b)
  return cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127
}

export async function skinToBlack(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || !inputBuffer.length) {
    throw new Error('Buffer gambar kosong.')
  }
  const img = sharp(inputBuffer).rotate().ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info // channels = 4 (RGBA)

  for (let i = 0; i < width * height; i++) {
    const o = i * channels
    const r = data[o], g = data[o + 1], b = data[o + 2]
    if (isSkinPixel(r, g, b)) {
      data[o] = Math.round(r * DARKEN)
      data[o + 1] = Math.round(g * DARKEN)
      data[o + 2] = Math.round(b * DARKEN)
      // Alpha (data[o+3]) dipertahankan
    }
  }

  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer()
}

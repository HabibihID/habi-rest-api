// blurImage — blur foto pakai sharp (100% milik sendiri).
//
// Cara kerja:
//   1. Baca buffer gambar (format apapun yang didukung sharp)
//   2. Terapkan Gaussian blur dengan sigma = level (1-50)
//   3. Return buffer PNG.
//
// Ditulis dari nol untuk HABI REST API.

import sharp from 'sharp'

export const MIN_BLUR_LEVEL = 1
export const MAX_BLUR_LEVEL = 50
export const DEFAULT_BLUR_LEVEL = 15

export async function blurImage(inputBuffer, level = DEFAULT_BLUR_LEVEL) {
  const sigma = Math.min(MAX_BLUR_LEVEL, Math.max(MIN_BLUR_LEVEL, Number(level) || DEFAULT_BLUR_LEVEL))
  const out = await sharp(inputBuffer)
    .blur(sigma)
    .png()
    .toBuffer()
  return out
}

export default { blurImage, MIN_BLUR_LEVEL, MAX_BLUR_LEVEL, DEFAULT_BLUR_LEVEL }

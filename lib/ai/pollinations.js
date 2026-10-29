// Pollinations — Generate gambar AI via image.pollinations.ai untuk HABI REST API.
// Mesin kedua untuk .text2img (selain Cloudflare Workers AI).
// Filter keamanan API (safe=true) SENGAJA dinyalakan: bot dipakai di grup publik.
// Provider gratis ini fluktuatif (rate limit / 402 antar-model) — ada 1x retry.
import axios from 'axios'

export const POLLINATIONS_MODELS = ['flux', 'turbo', 'sana']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchOnce(prompt, useModel, w, h) {
  const seed = Math.floor(Math.random() * 1000000000)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?model=${useModel}&width=${w}&height=${h}&seed=${seed}&nologo=true&safe=true`
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (res.status === 429) throw new Error('Pollinations lagi kena rate limit, coba lagi sebentar.')
  if (res.status !== 200) throw new Error(`Pollinations HTTP ${res.status}`)
  const buf = Buffer.from(res.data)
  if (!buf.length) throw new Error('Pollinations mengembalikan gambar kosong.')
  return buf
}

/**
 * Generate gambar dari prompt. Return Buffer JPEG.
 * model: 'flux' (default) | 'turbo' | 'sana'. width/height diklamp 256..1280.
 */
export async function pollinationsImage(prompt, { model = 'flux', width = 1024, height = 1024 } = {}) {
  if (!prompt) throw new Error('Prompt tidak boleh kosong.')
  const useModel = POLLINATIONS_MODELS.includes(model) ? model : 'flux'
  const w = Math.min(1280, Math.max(256, Number(width) || 1024))
  const h = Math.min(1280, Math.max(256, Number(height) || 1024))
  try {
    return await fetchOnce(prompt, useModel, w, h)
  } catch (e1) {
    await sleep(3000)
    return await fetchOnce(prompt, useModel, w, h)
  }
}

export default { pollinationsImage, POLLINATIONS_MODELS }

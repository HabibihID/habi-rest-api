// /api/tts — Text to Speech via Google Translate TTS
import { fetchRetry } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'google-tts'

export async function textToSpeech(text, lang = 'id') {
  if (!text) throw new Error('Teks wajib diisi')
  if (text.length > 200) throw new Error('Maksimal 200 karakter')
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`
  await throttle(PROVIDER, 1000)
  const res = await fetchRetry(url, {
    headers: { 'Referer': 'https://translate.google.com/' },
  }, { provider: PROVIDER, timeout: 30000 })
  if (!res.ok) throw new Error('Gagal generate TTS')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('Audio tidak valid')
  return buf
}

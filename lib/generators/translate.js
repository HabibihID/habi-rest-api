// Translate — pakai MyMemory API (gratis, tanpa key)
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'mymemory'

export async function translate(text, target = 'id', source = 'auto') {
  const sl = source === 'auto' ? 'autodetect' : source
  const q = new URLSearchParams({ q: text, langpair: `${sl}|${target}` })
  await throttle(PROVIDER, 1000)
  const j = await httpGet(`https://api.mymemory.translated.net/get?${q}`, { provider: PROVIDER })
  const out = j?.responseData?.translatedText
  if (!out) throw new Error('Translate tidak mengembalikan hasil')
  return {
    original: text,
    translated: out,
    from: source,
    to: target
  }
}

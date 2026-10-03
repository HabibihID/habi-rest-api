// Translate — pakai MyMemory API (gratis, tanpa key)
export async function translate(text, target = 'id', source = 'auto') {
  const sl = source === 'auto' ? 'autodetect' : source
  const q = new URLSearchParams({ q: text, langpair: `${sl}|${target}` })
  const r = await fetch(`https://api.mymemory.translated.net/get?${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  if (!r.ok) throw new Error('Translate gagal')
  const j = await r.json()
  const out = j?.responseData?.translatedText
  if (!out) throw new Error('Translate tidak mengembalikan hasil')
  return {
    original: text,
    translated: out,
    from: source,
    to: target
  }
}

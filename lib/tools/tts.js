// /api/tts — Text to Speech via Google Translate TTS
export async function textToSpeech(text, lang = 'id') {
  if (!text) throw new Error('Teks wajib diisi')
  if (text.length > 200) throw new Error('Maksimal 200 karakter')
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error('Gagal generate TTS')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('Audio tidak valid')
  return buf
}

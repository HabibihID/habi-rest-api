// Ringkas artikel — fetch teks artikel lalu ringkas pakai Pollinations text API.
// Ditulis dari nol untuk HABI REST API. Gratis, tanpa API key.
//
// GET /api/ringkas?url= -> { status:true, title, ringkasan }

async function fetchTimeout(url, opts = {}, ms = 30000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

function htmlToText(html) {
  // buang script/style/nav/footer
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
  // ambil <article> kalau ada, kalau tidak pakai <p>
  const article = t.match(/<article[\s\S]*?<\/article>/i)
  const paras = (article ? article[0] : t).match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
  t = paras.join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/<[^>]+>/g, '').trim().slice(0, 150)
  return { title, text: t }
}

export async function ringkasArtikel(url) {
  url = String(url || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('Parameter ?url= harus URL http/https.')

  const r = await fetchTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      Accept: 'text/html',
    },
  }, 30000)
  if (!r.ok) throw new Error(`Gagal buka artikel: HTTP ${r.status}`)
  const html = await r.text()
  const { title, text } = htmlToText(html)
  if (text.length < 200) throw new Error('Teks artikel terlalu pendek / tidak terbaca.')

  const snippet = text.slice(0, 6000)
  const prompt = `Ringkas artikel berikut dalam Bahasa Indonesia. Buat ringkasan padat 3-5 kalimat yang mencakup poin-poin penting. Langsung ke isi ringkasan, tanpa pembuka.\n\nArtikel:\n${snippet}`
  const ai = await fetchTimeout(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
    headers: { 'User-Agent': 'HABI-REST-API/1.0' },
  }, 90000)
  if (!ai.ok) throw new Error(`AI gagal: HTTP ${ai.status}`)
  const ringkasan = (await ai.text()).trim()
  if (!ringkasan) throw new Error('AI mengembalikan ringkasan kosong.')

  return { title: title || 'Tanpa judul', ringkasan }
}

// YouTube search — scrape ytInitialData
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export async function ytSearch(query, limit = 10) {
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' }
  })
  const html = await res.text()
  const marker = 'var ytInitialData = '
  const idx = html.indexOf(marker)
  if (idx === -1) throw new Error('Struktur YouTube berubah')

  const jsonStart = idx + marker.length
  let depth = 0, end = -1, inStr = false, esc = false
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') inStr = !inStr
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (end === -1) throw new Error('Parse gagal')
  const data = JSON.parse(html.slice(jsonStart, end))

  const results = []
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object' || results.length >= limit) return
    if (obj.videoRenderer) {
      const v = obj.videoRenderer
      results.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Tanpa judul',
        duration: v.lengthText?.simpleText || '-',
        channel: v.ownerText?.runs?.[0]?.text || '-',
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: v.thumbnail?.thumbnails?.pop()?.url || null
      })
      return
    }
    for (const k in obj) walk(obj[k])
  }
  walk(data)

  if (!results.length) throw new Error('Tidak ada hasil')
  return { query, count: results.length, results }
}

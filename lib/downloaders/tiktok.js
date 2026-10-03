// TikTok downloader — pakai tikwm API (tested working di bot HABI)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function fetchTimeout(url, opts = {}, ms = 20000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

export async function tiktokDl(inputUrl) {
  const r = await fetchTimeout(`https://www.tikwm.com/api/?url=${encodeURIComponent(inputUrl)}&hd=1`, {
    headers: { 'User-Agent': UA }
  })
  if (!r.ok) throw new Error(`tikwm HTTP ${r.status}`)
  const j = await r.json()
  if (j?.code !== 0 || !j?.data) throw new Error('tikwm tidak mengembalikan data')

  const d = j.data
  const fix = u => u?.startsWith('http') ? u : (u ? `https://www.tikwm.com${u}` : null)

  const images = Array.isArray(d.images) ? d.images.map(fix).filter(Boolean) : []
  const isImage = images.length > 0

  return {
    title: d.title || null,
    author: d.author?.nickname || d.author?.unique_id || null,
    duration: d.duration || null,
    type: isImage ? 'image' : 'video',
    images,
    image_count: images.length,
    video_hd: fix(d.hdplay) || null,
    video: fix(d.play) || null,
    video_wm: fix(d.wmplay) || null,
    audio: fix(d.music) || null,
    cover: fix(d.cover) || null
  }
}

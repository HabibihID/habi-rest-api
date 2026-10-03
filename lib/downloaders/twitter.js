// Twitter/X downloader — pakai fxtwitter (tested working di bot HABI)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export async function twitterDl(inputUrl) {
  // Ubah ke fxtwitter API
  const fxUrl = inputUrl
    .replace(/twitter\.com/i, 'fxtwitter.com')
    .replace(/x\.com/i, 'fxtwitter.com')

  const r = await fetch(fxUrl, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`fxtwitter HTTP ${r.status}`)
  const html = await r.text()

  // Cari video URL
  const video = html.match(/https:\/\/video\.twimg\.com[^"\\\s]+\.mp4/)?.[0]
    || html.match(/<meta property="og:video" content="([^"]+)"/)?.[1]
    || null

  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null
  const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1]
    || html.match(/<title>([^<]+)<\/title>/)?.[1] || null

  if (!video && !image) throw new Error('Media tidak ditemukan di tweet ini')

  return { title, video, image, type: video ? 'video' : 'image' }
}

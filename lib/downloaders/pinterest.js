// Pinterest downloader — scrape langsung (tested working di bot HABI)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export async function pinterestDl(inputUrl) {
  const res = await fetch(inputUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  let pageUrl = res.url.split('?')[0]
  let html = await res.text()

  if (/\/sent\/$/.test(pageUrl)) {
    pageUrl = pageUrl.replace(/\/sent\/$/, '/')
    const res2 = await fetch(pageUrl, { headers: { 'User-Agent': UA } })
    html = await res2.text()
  }

  const video = html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"\\\s]+\.mp4/)?.[0] || null

  let image = html.match(/og:image[^>]*content="([^"]+)"/)?.[1]
    || html.match(/content="([^"]+)"[^>]*og:image/)?.[1]
    || null

  if (image) {
    image = image.replace(/&amp;/g, '&')
    if (image.includes('/736x/')) {
      const orig = image.replace('/736x/', '/originals/')
      try {
        const check = await fetch(orig, { method: 'HEAD', headers: { 'User-Agent': UA } })
        if (check.ok) image = orig
      } catch {}
    }
  }

  if (!video && !image) throw new Error('Media tidak ditemukan di pin ini')

  return { video, image, type: video ? 'video' : 'image' }
}

// Pinterest downloader — scrape langsung (tested working di bot HABI)
import { httpGet, fetchRetry } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'pinterest'

export async function pinterestDl(inputUrl) {
  await throttle(PROVIDER, 1000)
  const res = await fetchRetry(inputUrl, { redirect: 'follow' }, { provider: PROVIDER })
  let pageUrl = res.url.split('?')[0]
  let html = await res.text()

  if (/\/sent\/$/.test(pageUrl)) {
    pageUrl = pageUrl.replace(/\/sent\/$/, '/')
    await throttle(PROVIDER, 1000)
    html = await httpGet(pageUrl, { provider: PROVIDER })
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
        await throttle(PROVIDER, 1000)
        const check = await fetchRetry(orig, { method: 'HEAD' }, { provider: PROVIDER })
        if (check.ok) image = orig
      } catch { /* tetap pakai versi 736x */ }
    }
  }

  if (!video && !image) throw new Error('Media tidak ditemukan di pin ini')

  return { video, image, type: video ? 'video' : 'image' }
}

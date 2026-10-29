// Twitter/X downloader — pakai fxtwitter (tested working di bot HABI)
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'fxtwitter'

export async function twitterDl(inputUrl) {
  // Ubah ke fxtwitter API
  const fxUrl = inputUrl
    .replace(/twitter\.com/i, 'fxtwitter.com')
    .replace(/x\.com/i, 'fxtwitter.com')

  await throttle(PROVIDER, 1000)
  const html = await httpGet(fxUrl, { provider: PROVIDER })

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

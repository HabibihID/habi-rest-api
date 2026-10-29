// CapCut downloader — proxy ke siputzx API
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'siputzx'

export async function capcutDl(inputUrl) {
  await throttle(PROVIDER, 1000)
  const j = await httpGet(
    `https://api.siputzx.my.id/api/d/capcut?url=${encodeURIComponent(inputUrl)}`,
    { provider: PROVIDER }
  )
  if (!j?.status || !j?.data) throw new Error(j?.error || 'Template tidak ditemukan')
  const url = j.data.originalVideoUrl || j.data.videoUrl || j.data.url
  if (!url) throw new Error('Video tidak ditemukan')
  return {
    title: j.data.title || 'Template CapCut',
    video: url,
    cover: j.data.cover || null
  }
}

// Screenshot web (pakai thum.io - gratis, tanpa API key)
import { fetchRetry } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'thumio'

export async function ssweb(url) {
  // Validasi URL
  let target
  try {
    target = new URL(url)
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error()
  } catch {
    throw new Error('URL tidak valid')
  }

  const shotUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${url}`
  await throttle(PROVIDER, 1000)
  // Butuh binary (Buffer), pakai fetchRetry langsung
  const r = await fetchRetry(shotUrl, {}, { provider: PROVIDER, timeout: 30000 })
  if (!r.ok) throw new Error('Gagal mengambil screenshot')
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) throw new Error('Screenshot gagal')
  return buf
}

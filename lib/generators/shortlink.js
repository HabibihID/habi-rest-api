// Shortlink (pakai is.gd - sama kayak bot)
import { httpGet } from '../http.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'isgd'

export async function shortlink(url) {
  await throttle(PROVIDER, 1000)
  const short = (await httpGet(
    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
    { provider: PROVIDER }
  )).trim()
  if (!short.startsWith('https://')) throw new Error('URL tidak valid untuk shortlink')
  return short
}

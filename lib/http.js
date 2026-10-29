/**
 * lib/http.js — Standardized HTTP client for HABI REST API
 *
 * Prinsip anti-blokir IP:
 * - Setiap request keluar WAJIB pakai timeout (default 15 detik)
 * - Retry otomatis dengan exponential backoff untuk error sementara (5xx, timeout, network)
 * - TIDAK me-retry untuk 4xx (client error) kecuali 429 (rate limit)
 * - User-Agent browser yang wajar, dirotasi per request
 * - TIDAK ada bypass anti-bot, fingerprint manipulation, atau CAPTCHA bypass
 *
 * Penggunaan:
 *   import { httpGet, httpPost } from '../http.js'
 *   const data = await httpGet('https://api.example.com/data', { timeout: 10000 })
 */

const BROWSER_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
]

function randomUA() {
  return BROWSER_UAS[Math.floor(Math.random() * BROWSER_UAS.length)]
}

const DEFAULT_TIMEOUT = 15000
const DEFAULT_RETRIES = 2

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

class HttpError extends Error {
  constructor(message, { status = 0, provider = 'unknown', url = '' } = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.provider = provider
    this.url = url
  }
}

/**
 * Fetch dengan timeout via AbortController.
 * Tidak melempar untuk status HTTP error — kembalikan response apa adanya,
 * kecuali network error / timeout / abort.
 */
async function fetchTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        ...(options.headers || {}),
      },
    })
    return res
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new HttpError(`Request timeout setelah ${timeoutMs}ms`, { provider: options._provider || 'unknown', url })
    }
    throw new HttpError(`Network error: ${err.message}`, { provider: options._provider || 'unknown', url })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch dengan retry + exponential backoff.
 * Retry HANYA untuk: timeout, network error, HTTP 5xx, HTTP 429.
 * TIDAK retry untuk 4xx lainnya.
 */
export async function fetchRetry(url, options = {}, retryOpts = {}) {
  const {
    retries = DEFAULT_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    backoffBase = 1000,
    provider = 'unknown',
  } = retryOpts

  const opts = { ...options, _provider: provider }
  let lastErr = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchTimeout(url, opts, timeout)

      // Sukses
      if (res.ok) return res

      // 429: rate limited — tunggu sesuai Retry-After atau backoff, lalu retry
      if (res.status === 429 && attempt < retries) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10)
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoffBase * Math.pow(2, attempt))
        continue
      }

      // 5xx: server error — retry dengan backoff
      if (res.status >= 500 && attempt < retries) {
        await sleep(backoffBase * Math.pow(2, attempt))
        continue
      }

      // 4xx lain atau attempt habis: kembalikan response (biar caller yang handle)
      return res
    } catch (err) {
      lastErr = err
      // Network error / timeout: retry dengan backoff
      if (attempt < retries) {
        await sleep(backoffBase * Math.pow(2, attempt))
        continue
      }
    }
  }

  throw lastErr || new HttpError('Semua percobaan gagal', { provider, url })
}

/**
 * GET JSON dengan standar penuh: timeout + retry + parse aman.
 * Melempar HttpError dengan pesan yang jelas bila gagal.
 */
export async function httpGet(url, { timeout, retries, provider = 'unknown', headers = {} } = {}) {
  const res = await fetchRetry(url, { headers }, { timeout, retries, provider })
  if (!res.ok) {
    throw new HttpError(`Provider ${provider} merespons ${res.status}`, { status: res.status, provider, url })
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return await res.json()
  }
  return await res.text()
}

/**
 * POST JSON dengan standar penuh.
 */
export async function httpPost(url, body, { timeout, retries, provider = 'unknown', headers = {} } = {}) {
  const res = await fetchRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }, { timeout, retries, provider })
  if (!res.ok) {
    throw new HttpError(`Provider ${provider} merespons ${res.status}`, { status: res.status, provider, url })
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return await res.json()
  }
  return await res.text()
}

export { HttpError }
export default { fetchRetry, httpGet, httpPost, HttpError }

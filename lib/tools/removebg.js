// RemoveBG — via self-hosted rembg API (127.0.0.1:8000).
// Fallback ke iLoveIMG kalau API lokal mati.

import { fetchRetry } from '../http.js'
import { throttle } from '../ratelimit.js'

const REMBG_URL = process.env.REMBG_API_URL || 'http://127.0.0.1:8000/remove-bg'

async function removeBgLocal(imageBuffer) {
  const form = new FormData()
  form.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg')
  // API lokal (localhost) — tanpa throttle, tapi tetap pakai timeout standar
  const r = await fetchRetry(REMBG_URL, {
    method: 'POST',
    body: form,
  }, { provider: 'rembg-local', timeout: 120000 })
  if (!r.ok) {
    const errJson = await r.json().catch(() => null)
    throw new Error(`Rembg API error (${r.status}): ${errJson?.error || 'unknown'}`)
  }
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('image/')) throw new Error('Rembg API tidak return gambar')
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) throw new Error('Hasil gambar terlalu kecil/corrupt')
  return buf
}

// --- Fallback iLoveIMG ---
const BASE_URL = 'https://www.iloveimg.com'
const TOOL = 'removebackgroundimage'
const headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
}

// Fetch JSON dengan timeout standar (untuk API iLoveIMG)
async function fj(url, opts = {}, ms = 30000) {
  await throttle('iloveimg', 2000)
  const r = await fetchRetry(url, opts, { provider: 'iloveimg', timeout: ms })
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) }
}

async function removeBgIloveimg(imageUrl) {
  await throttle('iloveimg', 2000)
  const pr = await fetchRetry(`${BASE_URL}/id/hapus-latar-belakang`, { headers }, { provider: 'iloveimg', timeout: 30000 })
  if (pr.status === 403) throw new Error('Terblokir Cloudflare (403)')
  const html = await pr.text()
  const tm = html.match(/["']?token["']?\s*:\s*["']([^"']+)["']/i)
  if (!tm) throw new Error('Gagal ekstrak token')
  const auth = { ...headers, 'Accept': 'application/json', 'Authorization': `Bearer ${tm[1]}`, 'Origin': BASE_URL, 'Referer': `${BASE_URL}/id/hapus-latar-belakang` }
  const tr = await fj(`https://api.iloveimg.com/v1/start/${TOOL}`, { headers: auth })
  const { task, server } = tr.data || {}
  if (!task || !server) throw new Error('Gagal start task')
  let ur = await fj(`https://${server}/v1/upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, cloud_file: imageUrl })
  })
  if (!ur.data?.server_filename) {
    ur = await fj(`https://${server}/v1/upload`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, url: imageUrl })
    })
  }
  if (!ur.data?.server_filename) throw new Error('Gagal upload')
  await fj(`https://${server}/v1/process`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, tool: TOOL, files: [{ server_filename: ur.data.server_filename, filename: 'image.jpg' }] })
  })
  await throttle('iloveimg', 2000)
  const dr = await fetchRetry(`https://${server}/v1/download/${task}`, { headers }, { provider: 'iloveimg', timeout: 90000 })
  if (!dr.ok) throw new Error(`Gagal download (${dr.status})`)
  return Buffer.from(await dr.arrayBuffer())
}

export async function removeBg(imageUrl) {
  if (!imageUrl) throw new Error('URL Gambar wajib diisi!')
  // Download gambar dulu
  const ir = await fetchRetry(imageUrl, {}, { provider: 'removebg-src', timeout: 30000 })
  if (!ir.ok) throw new Error(`Gagal download gambar (${ir.status})`)
  const buf = Buffer.from(await ir.arrayBuffer())

  // Coba API lokal dulu; gagal → fallback ke iLoveIMG (tanpa log berisik)
  try {
    return await removeBgLocal(buf)
  } catch {
    return await removeBgIloveimg(imageUrl)
  }
}

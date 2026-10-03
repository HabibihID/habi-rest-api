// RemoveBG — via self-hosted rembg API (127.0.0.1:8000).
// Fallback ke iLoveIMG kalau API lokal mati.

const REMBG_URL = process.env.REMBG_API_URL || 'http://127.0.0.1:8000/remove-bg'

async function removeBgLocal(imageBuffer) {
  const form = new FormData()
  form.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg')
  const r = await fetch(REMBG_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120000),
  })
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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
}

async function fj(url, opts = {}, ms = 30000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { ...opts, signal: c.signal })
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) }
  } finally { clearTimeout(t) }
}

async function removeBgIloveimg(imageUrl) {
  const pr = await fetch(`${BASE_URL}/id/hapus-latar-belakang`, { headers, signal: AbortSignal.timeout(30000) })
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
  const dr = await fetch(`https://${server}/v1/download/${task}`, { headers, signal: AbortSignal.timeout(90000) })
  if (!dr.ok) throw new Error(`Gagal download (${dr.status})`)
  return Buffer.from(await dr.arrayBuffer())
}

export async function removeBg(imageUrl) {
  if (!imageUrl) throw new Error('URL Gambar wajib diisi!')
  // Download gambar dulu
  const ir = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!ir.ok) throw new Error(`Gagal download gambar (${ir.status})`)
  const buf = Buffer.from(await ir.arrayBuffer())

  // Coba API lokal dulu
  try {
    return await removeBgLocal(buf)
  } catch (e) {
    console.log('[removebg] Local API gagal, fallback ke iLoveIMG:', e.message)
  }
  // Fallback iLoveIMG
  return await removeBgIloveimg(imageUrl)
}

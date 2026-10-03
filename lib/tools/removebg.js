// RemoveBG — Hapus background via iLoveIMG (patched).
// Ditulis untuk HABI REST API.

const BASE_URL = 'https://www.iloveimg.com'
const TOOL = 'removebackgroundimage'

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1'
}

async function fj(url, opts = {}, ms = 30000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { ...opts, signal: c.signal })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, status: r.status, data }
  } finally { clearTimeout(t) }
}

export async function removeBg(imageUrl) {
  if (!imageUrl) throw new Error('URL Gambar wajib diisi!')

  // 1. Ambil token dari halaman
  const pr = await fetch(`${BASE_URL}/id/hapus-latar-belakang`, {
    headers, signal: AbortSignal.timeout(30000)
  })
  if (pr.status === 403) throw new Error('Terblokir Cloudflare/Anti-Bot iLoveIMG (403)')
  const html = await pr.text()
  const tm = html.match(/["']?token["']?\s*:\s*["']([^"']+)["']/i)
  if (!tm) throw new Error('Gagal ekstrak token. Struktur web iLoveIMG mungkin berubah.')
  const auth = {
    ...headers,
    'Accept': 'application/json, text/plain, */*',
    'Authorization': `Bearer ${tm[1]}`,
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/id/hapus-latar-belakang`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  }

  // 2. Start task
  const tr = await fj(`https://api.iloveimg.com/v1/start/${TOOL}`, { headers: auth })
  const { task, server } = tr.data || {}
  if (!task || !server) throw new Error('Gagal mendapatkan Task ID')

  // 3. Upload (coba cloud_file, fallback url)
  let ur = await fj(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, cloud_file: imageUrl })
  })
  if (!ur.data?.server_filename) {
    ur = await fj(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, url: imageUrl })
    })
  }
  const serverFilename = ur.data?.server_filename
  if (!serverFilename) throw new Error('Gagal mengunggah gambar ke server pemrosesan')

  // 4. Process
  await fj(`https://${server}/v1/process`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, tool: TOOL, files: [{ server_filename: serverFilename, filename: 'image.jpg' }] })
  })

  // 5. Download hasil
  const dr = await fetch(`https://${server}/v1/download/${task}`, {
    headers, signal: AbortSignal.timeout(90000)
  })
  if (!dr.ok) throw new Error(`Gagal download hasil (${dr.status})`)
  return Buffer.from(await dr.arrayBuffer())
}

// RemoveBG — Hapus background via iLoveIMG.
// Ditulis untuk HABI REST API.

const BASE = 'https://www.iloveimg.com'
const TOOL = 'removebackgroundimage'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'application/json',
  'Origin': BASE,
  'Referer': `${BASE}/id/hapus-latar-belakang`,
}

async function fj(url, opts = {}, ms = 30000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { ...opts, signal: c.signal })
    return { ok: r.ok, data: await r.json().catch(() => null) }
  } finally { clearTimeout(t) }
}

export async function removeBg(imageUrl) {
  if (!imageUrl) throw new Error('URL gambar wajib diisi')

  const pr = await fetch(`${BASE}/id/hapus-latar-belakang`, {
    headers: HEADERS, signal: AbortSignal.timeout(30000)
  })
  const html = await pr.text()
  const tm = html.match(/"token"\s*:\s*"([^"]+)"/)
  if (!tm) throw new Error('Gagal ambil token')
  const auth = { ...HEADERS, 'Authorization': `Bearer ${tm[1]}` }

  const tr = await fj(`https://api.iloveimg.com/v1/start/${TOOL}`, { headers: auth })
  const { task, server } = tr.data || {}
  if (!task || !server) throw new Error('Gagal start task')

  const ur = await fj(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, cloud_file: imageUrl })
  })
  if (!ur.data?.server_filename) throw new Error('Gagal upload')

  await fj(`https://${server}/v1/process`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, tool: TOOL, files: [{ server_filename: ur.data.server_filename, filename: 'image.jpg' }] })
  })

  // Download hasil sebagai buffer
  const dr = await fetch(`https://${server}/v1/download/${task}`, {
    headers: HEADERS, signal: AbortSignal.timeout(90000)
  })
  if (!dr.ok) throw new Error('Gagal download hasil')
  return Buffer.from(await dr.arrayBuffer())
}

// Tourl — upload file ke catbox.moe, return URL publik.
// Ditulis dari nol untuk HABI REST API. Gratis, tanpa API key.
//
// POST /api/tourl (raw body: image/*, video/*, max 200MB)
// -> { status:true, url }

const MAX_SIZE = 200 * 1024 * 1024 // 200 MB (limit catbox)

async function fetchTimeout(url, opts = {}, ms = 120000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

function detectExt(buf, mime) {
  if (/jpe?g/i.test(mime)) return 'jpg'
  if (/png/i.test(mime)) return 'png'
  if (/webp/i.test(mime)) return 'webp'
  if (/gif/i.test(mime)) return 'gif'
  if (/mp4/i.test(mime)) return 'mp4'
  if (/webm/i.test(mime)) return 'webm'
  if (/mpeg/i.test(mime) || /mp3/i.test(mime)) return 'mp3'
  if (/ogg/i.test(mime)) return 'ogg'
  if (/pdf/i.test(mime)) return 'pdf'
  // magic bytes fallback
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png'
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif'
  return 'bin'
}

export async function uploadToCatbox(buf, mime = 'application/octet-stream') {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('File kosong.')
  if (buf.length > MAX_SIZE) throw new Error('File maksimal 200 MB.')

  const ext = detectExt(buf, mime)
  const blob = new Blob([buf], { type: mime })
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', blob, `habi-${Date.now()}.${ext}`)

  const r = await fetchTimeout('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: { 'User-Agent': 'HABI-REST-API/1.0' },
  })
  const text = (await r.text()).trim()
  if (!r.ok || !text.startsWith('https://')) {
    throw new Error(`Catbox gagal: ${text.slice(0, 120) || `HTTP ${r.status}`}`)
  }
  return text
}

// Sticker.ly — cari pack & ambil isi pack (sumber upstream: izuka-api,
// kode kiriman user 2026-10-21). File stiker dibangun dari
// resourceUrlPrefix + nama file (sudah .webp dari CDN Sticker.ly).
const UP = 'https://my.izuka-api.xyz/api/search'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function getJson(url) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 30000)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: c.signal })
    if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`)
    return await r.json()
  } finally { clearTimeout(t) }
}

function packUrls(prefix, files, cap = 30) {
  if (!prefix || !Array.isArray(files)) return []
  return files.slice(0, cap).map((f) => prefix + f)
}

export async function stickerlySearch(query) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Query pencarian kosong.')
  const j = await getJson(`${UP}/stickerly-search?query=${encodeURIComponent(q)}`)
  if (!j?.status || !Array.isArray(j.result)) throw new Error('Pencarian Sticker.ly gagal / tidak ditemukan.')
  return j.result.slice(0, 10).map((r) => ({
    name: r.name || 'Sticker Pack',
    author: r.authorName || r.user?.userName || '-',
    shareUrl: r.shareUrl || '',
    packId: r.packId || '',
    isAnimated: !!(r.isAnimated || r.animated),
    stickers: packUrls(r.resourceUrlPrefix, r.resourceFiles),
  })).filter((p) => p.shareUrl)
}

export async function stickerlyPack(url) {
  const u = String(url || '').trim()
  if (!/sticker\.ly\/s\//i.test(u)) throw new Error('URL harus link pack sticker.ly/s/...')
  const j = await getJson(`${UP}/stickerly-pack?url=${encodeURIComponent(u)}`)
  const res = j?.result
  if (!j?.status || !res || !Array.isArray(res.stickers) || !res.stickers.length) {
    throw new Error('Detail pack tidak ditemukan.')
  }
  const first = res.stickers[0]
  const info = first.stickerPack || {}
  const prefix = String(info.trayResourceUrl || '').replace(/[^/]+$/, '')
  const files = info.resourceFileNames || res.stickers.map((s) => s.fileName)
  return {
    name: info.name || res.name || 'Sticker.ly Pack',
    author: info.authorName || res.authorName || '-',
    isAnimated: !!(res.isAnimated || res.animated),
    stickers: packUrls(prefix, files),
  }
}

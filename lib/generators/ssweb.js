// Screenshot web (pakai thum.io - gratis, tanpa API key)
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
  const r = await fetch(shotUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  })
  if (!r.ok) throw new Error('Gagal mengambil screenshot')
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) throw new Error('Screenshot gagal')
  return buf
}

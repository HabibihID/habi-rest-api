// CapCut downloader — proxy ke siputzx API
export async function capcutDl(inputUrl) {
  const r = await fetch(`https://api.siputzx.my.id/api/d/capcut?url=${encodeURIComponent(inputUrl)}`)
  if (!r.ok) throw new Error(`CapCut API HTTP ${r.status}`)
  const j = await r.json()
  if (!j?.status || !j?.data) throw new Error(j?.error || 'Template tidak ditemukan')
  const url = j.data.originalVideoUrl || j.data.videoUrl || j.data.url
  if (!url) throw new Error('Video tidak ditemukan')
  return {
    title: j.data.title || 'Template CapCut',
    video: url,
    cover: j.data.cover || null
  }
}

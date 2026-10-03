// AIO — All-in-one media downloader via mediadownloader.web.id
// Ditulis untuk HABI REST API.

export async function aioDl(targetUrl) {
  if (!targetUrl) throw new Error('URL wajib diisi')
  const endpoint = 'https://mediadownloader.web.id/api/download'
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 30000)
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Type': 'application/json',
        'Referer': 'https://mediadownloader.web.id/',
        'Origin': 'https://mediadownloader.web.id',
      },
      body: JSON.stringify({ url: targetUrl }),
      signal: c.signal,
    })
    const resData = await r.json()
    if (!resData?.success || !resData?.result) throw new Error('Respon tidak valid')
    const res = resData.result
    return {
      title: res.title || res.description || 'Tanpa Judul',
      platform: res.platform || 'Unknown',
      thumbnail: res.thumbnail || null,
      medias: (res.downloads || []).map((dl) => ({
        label: dl.label || 'Media',
        url: dl.url,
        quality: dl.quality || 'Default',
        type: dl.type || 'media',
        ext: dl.ext || 'mp4',
      })),
    }
  } finally {
    clearTimeout(t)
  }
}

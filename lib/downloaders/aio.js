// AIO — All-in-one media downloader untuk HABI REST API.
// Mesin utama: mediadownloader.web.id. Mesin cadangan: getdl.space
// (lib/downloaders/getdl.js) — dipakai bila mesin utama gagal / hasil kosong.
import { httpPost } from '../http.js'
import { throttle } from '../ratelimit.js'
import { getdlDl } from './getdl.js'

const PROVIDER = 'mediadownloader'

async function primaryDl(targetUrl) {
  await throttle(PROVIDER, 1000)
  const resData = await httpPost('https://mediadownloader.web.id/api/download', { url: targetUrl }, {
    provider: PROVIDER,
    timeout: 30000,
    headers: {
      'Referer': 'https://mediadownloader.web.id/',
      'Origin': 'https://mediadownloader.web.id',
    },
  })
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
}

export async function aioDl(targetUrl) {
  if (!targetUrl) throw new Error('URL wajib diisi')
  try {
    const data = await primaryDl(targetUrl)
    if (data.medias.length) return { ...data, engine: PROVIDER }
    throw new Error('Mesin utama: tidak ada media ditemukan')
  } catch (e1) {
    try {
      const data = await getdlDl(targetUrl)
      return { ...data, engine: 'getdl' }
    } catch (e2) {
      throw new Error(`Semua mesin AIO gagal. Utama: ${e1.message}. GetDL: ${e2.message}`)
    }
  }
}

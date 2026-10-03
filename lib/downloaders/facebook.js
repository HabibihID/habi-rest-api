// Facebook downloader — pakai yt-dlp (tested working di bot HABI)
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveShareUrl(url) {
  // /share/r/ dan /share/v/ perlu di-resolve dulu (tested di bot)
  if (/facebook\.com\/share\/(r|v)\//i.test(url)) {
    return fetch(url, { method: 'HEAD', redirect: 'follow' })
      .then(r => r.url || url)
      .catch(() => url)
  }
  return Promise.resolve(url)
}

export async function facebookDl(inputUrl) {
  const url = await resolveShareUrl(inputUrl)

  return new Promise((resolve, reject) => {
    const yt = spawn('yt-dlp', [
      '--no-check-certificate',
      '--dump-json',
      '--no-playlist',
      url
    ], { timeout: 60000 })

    let out = '', err = ''
    yt.stdout.on('data', d => out += d)
    yt.stderr.on('data', d => err += d)
    yt.on('error', e => reject(new Error('yt-dlp tidak tersedia: ' + e.message)))
    yt.on('close', code => {
      if (code !== 0) return reject(new Error('Gagal mengambil info Facebook'))
      try {
        const info = JSON.parse(out)
        const formats = (info.formats || [])
          .filter(f => f.url && f.vcodec !== 'none')
          .sort((a, b) => (b.height || 0) - (a.height || 0))

        resolve({
          title: info.title || null,
          duration: info.duration || null,
          thumbnail: info.thumbnail || null,
          video_hd: formats.find(f => (f.height || 0) >= 720)?.url || null,
          video_sd: formats.find(f => (f.height || 0) < 720)?.url || formats[0]?.url || null,
          video: info.url || formats[0]?.url || null
        })
      } catch (e) {
        reject(new Error('Gagal parse data Facebook'))
      }
    })
  })
}

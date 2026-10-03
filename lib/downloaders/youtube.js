// YouTube downloader — pakai yt-dlp (tested working di bot HABI)
import { spawn } from 'node:child_process'

export async function youtubeDl(inputUrl, type = 'mp4') {
  return new Promise((resolve, reject) => {
    const yt = spawn('yt-dlp', [
      '--no-check-certificate',
      '--dump-json',
      '--no-playlist',
      inputUrl
    ], { timeout: 60000 })

    let out = ''
    yt.stdout.on('data', d => out += d)
    yt.stderr.on('data', () => {})
    yt.on('error', e => reject(new Error('yt-dlp tidak tersedia: ' + e.message)))
    yt.on('close', code => {
      if (code !== 0) return reject(new Error('Gagal mengambil info YouTube'))
      try {
        const info = JSON.parse(out)

        if (type === 'mp3') {
          const audio = (info.formats || [])
            .filter(f => f.url && f.acodec !== 'none' && f.vcodec === 'none')
            .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0]
          return resolve({
            title: info.title || null,
            duration: info.duration || null,
            thumbnail: info.thumbnail || null,
            audio: audio?.url || null,
            type: 'mp3'
          })
        }

        const videos = (info.formats || [])
          .filter(f => f.url && f.vcodec !== 'none' && f.acodec !== 'none')
          .sort((a, b) => (b.height || 0) - (a.height || 0))

        resolve({
          title: info.title || null,
          duration: info.duration || null,
          thumbnail: info.thumbnail || null,
          video_hd: videos.find(f => (f.height || 0) >= 720)?.url || null,
          video: videos[0]?.url || info.url || null,
          type: 'mp4'
        })
      } catch (e) {
        reject(new Error('Gagal parse data YouTube'))
      }
    })
  })
}

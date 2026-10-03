// Instagram downloader — pakai yt-dlp (fallback: scrape embed)
import { spawn } from 'node:child_process'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function ytDlpIG(url) {
  return new Promise((resolve, reject) => {
    const yt = spawn('yt-dlp', [
      '--no-check-certificate',
      '--dump-json',
      '--no-playlist',
      url
    ], { timeout: 60000 })

    let out = ''
    yt.stdout.on('data', d => out += d)
    yt.stderr.on('data', () => {})
    yt.on('error', e => reject(new Error('yt-dlp: ' + e.message)))
    yt.on('close', code => {
      if (code !== 0) return reject(new Error('yt-dlp gagal'))
      try {
        const info = JSON.parse(out)
        resolve({
          title: info.title || null,
          thumbnail: info.thumbnail || null,
          video: info.url || null,
          type: 'video'
        })
      } catch { reject(new Error('Parse gagal')) }
    })
  })
}

async function embedScrape(url) {
  // Coba via embed URL
  const id = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[2]
  if (!id) throw new Error('ID Instagram tidak ditemukan')
  throw new Error('Embed scrape belum tersedia')
}

export async function instagramDl(inputUrl) {
  try {
    return await ytDlpIG(inputUrl)
  } catch (e) {
    return await embedScrape(inputUrl)
  }
}

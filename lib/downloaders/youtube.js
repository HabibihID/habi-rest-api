// YouTube downloader — multi-fallback (dari script referensi user)
// Primary: ytconvert.org | Secondary: lbserver | Tertiary: savenow.to | Quaternary: ssyoutube
// Struktur fallback dipertahankan: bila satu provider mati, otomatis coba berikutnya.

import { httpGet, httpPost } from '../http.js'
import { throttle } from '../ratelimit.js'

const HEADERS_YTC = {
  'Accept': 'application/json',
  'Origin': 'https://media.ytmp3.gg',
  'Referer': 'https://media.ytmp3.gg/',
}
const delay = ms => new Promise(r => setTimeout(r, ms))

function extractVideoId(url) {
  try {
    const u = new URL(url)
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    if (u.hostname.includes('youtu.be')) return u.pathname.split('/')[1]?.split('?')[0]
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('?')[0]
    return null
  } catch { return null }
}

function buildThumbnail(url) {
  const id = extractVideoId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

async function getYoutubeTitle(url) {
  try {
    await throttle('youtube', 2000)
    const j = await httpGet(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { provider: 'youtube' }
    )
    return j.title || 'YouTube Video'
  } catch { return 'YouTube Video' }
}

// --- Primary: ytconvert ---
async function primaryConvert(url, type, quality) {
  const payload = type === 'mp3'
    ? { url, os: 'windows', output: { type: 'audio', format: 'mp3' } }
    : { url, os: 'windows', output: { type: 'video', format: 'mp4', quality: quality + 'p' } }

  await throttle('ytconvert', 1000)
  const convert = await httpPost('https://hub.ytconvert.org/api/download', payload, {
    provider: 'ytconvert', headers: HEADERS_YTC, timeout: 30000,
  })
  if (!convert.statusUrl) throw new Error('ytconvert no statusUrl')

  for (let i = 0; i < 40; i++) {
    await throttle('ytconvert', 1000)
    const data = await httpGet(convert.statusUrl, { provider: 'ytconvert', timeout: 20000 })
    if (data.status === 'completed' || data.downloadUrl) {
      return {
        title: convert.title || await getYoutubeTitle(url),
        downloadUrl: data.downloadUrl,
        thumbnail: buildThumbnail(url)
      }
    }
    if (data.status === 'error') throw new Error('ytconvert error')
    await delay(3000)
  }
  throw new Error('ytconvert timeout')
}

// --- Secondary: lbserver ---
async function secondaryDownload(url, type, quality = '128') {
  const params = type === 'mp3'
    ? { format: 'mp3', audio_quality: quality, url }
    : { format: quality, url }

  const q = new URLSearchParams(params)
  await throttle('lbserver', 1000)
  const data = await httpGet(`https://p.lbserver.xyz/ajax/download.php?${q}`, {
    provider: 'lbserver', timeout: 30000,
  })
  if (!data?.progress_url) throw new Error('lbserver no progress_url')

  for (let i = 0; i < 60; i++) {
    await throttle('lbserver', 1000)
    const res = await httpGet(data.progress_url, { provider: 'lbserver', timeout: 20000 })
    if (res.progress >= 1000 && res.download_url) {
      return {
        title: data.title || data.info?.title || await getYoutubeTitle(url),
        downloadUrl: res.download_url,
        thumbnail: data.info?.image || buildThumbnail(url)
      }
    }
    await delay(2000)
  }
  throw new Error('lbserver timeout')
}

// --- Tertiary: savenow.to ---
async function tertiaryDownload(url, type) {
  const format = type === 'mp3' ? 'mp3' : '720'
  const q = new URLSearchParams({ format, url, api: 'dfcb6d76f2f6a9894gjkege8a4ab232222' })
  await throttle('savenow', 1000)
  const data = await httpGet(`https://p.savenow.to/ajax/download.php?${q}`, {
    provider: 'savenow', timeout: 30000,
  })
  if (!data?.progress_url) throw new Error('savenow no progress_url')

  for (let i = 0; i < 40; i++) {
    await throttle('savenow', 1000)
    const res = await httpGet(data.progress_url, { provider: 'savenow', timeout: 20000 })
    if (res.success && res.download_url) {
      return {
        title: data.info?.title || await getYoutubeTitle(url),
        downloadUrl: res.download_url,
        thumbnail: data.info?.image || buildThumbnail(url)
      }
    }
    await delay(2500)
  }
  throw new Error('savenow timeout')
}

// --- Quaternary: ssyoutube.online (mp3 only) ---
const SS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'origin': 'https://ssyoutube.online',
  'referer': 'https://ssyoutube.online/en12/'
}

async function quaternaryDownload(url, type = 'mp3') {
  await throttle('ssyoutube', 1000)
  const html = await httpPost('https://ssyoutube.online/yt-video-detail/',
    new URLSearchParams({ videoURL: url }).toString(),
    { provider: 'ssyoutube', headers: SS_HEADERS, timeout: 25000 }
  )
  // Catatan: endpoint ini mengembalikan HTML, bukan JSON
  const htmlText = typeof html === 'string' ? html : ''
  const title = (htmlText.match(/videoTitle[^>]*>(.*?)</) || [])[1] || await getYoutubeTitle(url)
  const thumbnail = (htmlText.match(/thumbnail" src="([^"]+)/) || [])[1] || buildThumbnail(url)

  if (type === 'mp3') {
    await throttle('ssyoutube', 1000)
    const json = await httpPost('https://ssyoutube.online/wp-admin/admin-ajax.php',
      new URLSearchParams({ action: 'get_mp3_conversion_url', videoUrl: url }).toString(),
      { provider: 'ssyoutube', headers: SS_HEADERS, timeout: 25000 }
    )
    if (!json?.data?.url) throw new Error('SSYoutube gagal')
    return { title, thumbnail, downloadUrl: json.data.url }
  }
  throw new Error('SSYoutube MP4 skip')
}

export async function youtubeDl(inputUrl, type = 'mp4') {
  const quality = '360'
  let lastErr

  const attempts = type === 'mp3'
    ? [
        () => primaryConvert(inputUrl, 'mp3'),
        () => secondaryDownload(inputUrl, 'mp3'),
        () => tertiaryDownload(inputUrl, 'mp3'),
        () => quaternaryDownload(inputUrl, 'mp3')
      ]
    : [
        () => primaryConvert(inputUrl, 'mp4', quality),
        () => secondaryDownload(inputUrl, 'mp4', quality),
        () => tertiaryDownload(inputUrl, 'mp4')
      ]

  for (const fn of attempts) {
    try {
      const d = await fn()
      return {
        title: d.title,
        thumbnail: d.thumbnail,
        type,
        ...(type === 'mp3' ? { audio: d.downloadUrl } : { video: d.downloadUrl, video_hd: d.downloadUrl })
      }
    } catch (e) { lastErr = e }
  }
  throw new Error('Semua server YouTube gagal: ' + (lastErr?.message || 'unknown'))
}

// YouTube downloader — multi-fallback (dari script referensi user)
// Primary: ytconvert.org | Secondary: lbserver | Tertiary: savenow.to | Quaternary: ssyoutube

const HEADERS_YTC = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Origin': 'https://media.ytmp3.gg',
  'Referer': 'https://media.ytmp3.gg/',
  'User-Agent': 'Mozilla/5.0'
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
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    const j = await r.json()
    return j.title || 'YouTube Video'
  } catch { return 'YouTube Video' }
}

// --- Primary: ytconvert ---
async function primaryConvert(url, type, quality) {
  const payload = type === 'mp3'
    ? { url, os: 'windows', output: { type: 'audio', format: 'mp3' } }
    : { url, os: 'windows', output: { type: 'video', format: 'mp4', quality: quality + 'p' } }

  const r = await fetch('https://hub.ytconvert.org/api/download', {
    method: 'POST', headers: HEADERS_YTC, body: JSON.stringify(payload)
  })
  if (!r.ok) throw new Error('ytconvert HTTP ' + r.status)
  const convert = await r.json()
  if (!convert.statusUrl) throw new Error('ytconvert no statusUrl')

  for (let i = 0; i < 40; i++) {
    const s = await fetch(convert.statusUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await s.json()
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
  const r = await fetch(`https://p.lbserver.xyz/ajax/download.php?${q}`)
  const data = await r.json()
  if (!data?.progress_url) throw new Error('lbserver no progress_url')

  for (let i = 0; i < 60; i++) {
    const pr = await fetch(data.progress_url)
    const res = await pr.json()
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
  const r = await fetch(`https://p.savenow.to/ajax/download.php?${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const data = await r.json()
  if (!data?.progress_url) throw new Error('savenow no progress_url')

  for (let i = 0; i < 40; i++) {
    const pr = await fetch(data.progress_url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const res = await pr.json()
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
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/x-www-form-urlencoded',
  'origin': 'https://ssyoutube.online',
  'referer': 'https://ssyoutube.online/en12/'
}

async function quaternaryDownload(url, type = 'mp3') {
  const r = await fetch('https://ssyoutube.online/yt-video-detail/', {
    method: 'POST',
    headers: SS_HEADERS,
    body: new URLSearchParams({ videoURL: url }),
    signal: AbortSignal.timeout(25000)
  })
  const html = await r.text()
  const title = (html.match(/videoTitle[^>]*>(.*?)</) || [])[1] || await getYoutubeTitle(url)
  const thumbnail = (html.match(/thumbnail" src="([^"]+)/) || [])[1] || buildThumbnail(url)

  if (type === 'mp3') {
    const req = await fetch('https://ssyoutube.online/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: SS_HEADERS,
      body: new URLSearchParams({ action: 'get_mp3_conversion_url', videoUrl: url }),
      signal: AbortSignal.timeout(25000)
    })
    const json = await req.json()
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

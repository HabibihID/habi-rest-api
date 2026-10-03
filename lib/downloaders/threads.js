// Threads downloader — via headless browser (puppeteer-core).
//
// KENAPA HEADLESS: threads.net hanya serve JS shell untuk semua format URL
// (post, /t/ shortlink, /embed). Tidak ada oEmbed publik, yt-dlp tidak punya
// extractor, dan GraphQL internal butuh auth. Satu-satunya cara yang andal
// adalah render dengan browser lalu ambil media dari DOM.
//
// BUTUH: npm install puppeteer (+ chromium) di server API.
// Kalau browser tidak tersedia, fungsi ini throw error yang jelas.
//
// Return format standar: { caption, author, type, video/videoUrl, images }

import { execSync } from 'node:child_process'

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function normalizeThreadsUrl(input) {
  let url = String(input || '').trim()
  if (!url) throw new Error('URL Threads kosong')
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  if (!/threads\.(net|com)/i.test(url)) throw new Error('Bukan URL Threads yang valid')
  return url
}

async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer')
    return mod.default || mod
  } catch {}
  try {
    const mod = await import('puppeteer-core')
    return mod.default || mod
  } catch {}
  return null
}

function findChrome() {
  // Cek chromium sistem di lokasi umum (Linux)
  const cands = [
    process.env.CHROME_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ].filter(Boolean)
  for (const c of cands) {
    try {
      execSync(`test -x "${c}"`, { stdio: 'ignore' })
      return c
    } catch {}
  }
  return null
}

export async function threadsDl(inputUrl) {
  const url = normalizeThreadsUrl(inputUrl)

  const puppeteer = await loadPuppeteer()
  if (!puppeteer) {
    throw new Error(
      'Threads downloader butuh headless browser. Install di server API: npm install puppeteer'
    )
  }

  const chromePath = findChrome()
  const launchOpts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ],
    timeout: 60000
  }
  if (chromePath) launchOpts.executablePath = chromePath

  let browser = null
  try {
    browser = await puppeteer.launch(launchOpts)
    const page = await browser.newPage()
    await page.setUserAgent(UA)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })

    // Tunggu konten postingan muncul (maks 20 detik)
    await page.waitForFunction(
      () => document.querySelector('video, article img'),
      { timeout: 20000 }
    ).catch(() => {})

    // Ambil sedikit waktu ekstra biar media ke-load penuh
    await new Promise(r => setTimeout(r, 2500))

    const data = await page.evaluate(() => {
      const out = { videos: [], images: [], caption: '', author: '' }

      // Video: ambil src langsung atau dari <source>
      document.querySelectorAll('article video, [role="article"] video, video').forEach(v => {
        const src = v.currentSrc || v.src
          || v.querySelector('source')?.src || ''
        if (src && src.startsWith('http') && !out.videos.includes(src)) out.videos.push(src)
      })

      // Gambar postingan (bukan avatar/logo): filter ukuran wajar
      document.querySelectorAll('article img, [role="article"] img').forEach(img => {
        const src = img.currentSrc || img.src || ''
        if (!src.startsWith('http')) return
        if (/rsrc\.php|static\.cdninstagram\.com\/rsrc/i.test(src)) return // logo/statis
        const w = img.naturalWidth || 0
        if (w < 200) return // skip avatar/thumbnail kecil
        if (!out.images.includes(src)) out.images.push(src)
      })

      // Caption: teks postingan
      const article = document.querySelector('article, [role="article"]')
      if (article) {
        // Ambil paragraf teks, hindari username/waktu
        const spans = [...article.querySelectorAll('span[dir="auto"]')]
        const texts = spans.map(s => s.innerText?.trim()).filter(t => t && t.length > 2)
        out.caption = texts.slice(0, 3).join('\n').slice(0, 500) || ''
      }

      // Author: dari URL atau link profil
      const m = location.pathname.match(/@([^/]+)/)
      if (m) out.author = m[1]
      if (!out.author) {
        const profileLink = document.querySelector('article a[href^="/@"]')
        const pm = profileLink?.getAttribute('href')?.match(/@([^/]+)/)
        if (pm) out.author = pm[1]
      }

      return out
    })

    const video = data.videos[0] || null
    const images = data.images || []

    if (!video && images.length === 0) {
      throw new Error('Media tidak ditemukan. Postingan mungkin dihapus/private, atau Threads memblokir akses.')
    }

    return {
      caption: data.caption || null,
      author: data.author || null,
      type: video ? 'video' : 'image',
      video,
      videoUrl: video,
      videos: data.videos,
      image: images[0] || null,
      imageUrl: images[0] || null,
      images
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

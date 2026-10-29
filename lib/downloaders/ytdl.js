// ytdl — YouTube MP3/MP4 via yt-dlp lokal (100% API sendiri).
// Ditulis dari nol untuk HABI REST API.
//
// Konfigurasi via environment:
//   YTDLP_PROXY   — opsional, contoh: http://user:pass@1.2.3.4:8080
//                   jika kosong, yt-dlp jalan langsung tanpa proxy.
//   YTDLP_COOKIES — opsional, path ke file cookies Netscape.
//                   jika kosong/tidak ada, tidak dipakai.
//
// Catatan: proxy HANYA dipakai untuk proses yt-dlp (request ke YouTube),
// tidak memengaruhi koneksi WhatsApp/bot sama sekali.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const MAX_MP3_MB = 16   // batas wajar buat dikirim via WA
const MAX_MP4_MB = 100
const MAX_RETRY = 2     // maksimal percobaan ulang (tidak infinite)

// Ambil proxy dari env (tanpa hardcode credential di source).
function getProxyArgs() {
  const proxy = (process.env.YTDLP_PROXY || '').trim()
  if (!proxy) return []
  return ['--proxy', proxy]
}

// Ambil cookies dari env (opsional).
function getCookieArgs() {
  const p = (process.env.YTDLP_COOKIES || '').trim()
  if (!p) return []
  try {
    if (!fs.existsSync(p)) return []
  } catch { return [] }
  return ['--cookies', p]
}

function runYtDlp(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '--no-check-certificate',
      '--no-playlist',
      '--socket-timeout', '30',       // timeout per koneksi
      '--retries', '3',               // retry download fragment
      '--fragment-retries', '3',
      '--concurrent-fragments', '4',  // download paralel biar cepat
      '--http-chunk-size', '10M',
      ...getProxyArgs(),              // hanya jika YTDLP_PROXY diisi
      ...getCookieArgs(),             // hanya jika YTDLP_COOKIES diisi
      ...args,
    ]
    const p = spawn('yt-dlp', fullArgs)
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    const t = setTimeout(() => {
      p.kill('SIGKILL')
      reject(new Error('yt-dlp timeout: YouTube tidak merespons dalam waktu yang ditentukan.'))
    }, timeoutMs)
    p.on('error', (e) => { clearTimeout(t); reject(e) })
    p.on('close', (code) => {
      clearTimeout(t)
      if (code !== 0) {
        const lastErr = err.split('\n').filter(Boolean).pop() || `yt-dlp exit ${code}`
        reject(new Error(cleanYtDlpError(lastErr)))
      } else resolve(out.trim())
    })
  })
}

// Tampilkan error ASLI dari yt-dlp (maks 500 karakter).
// Tidak ada bypass CAPTCHA/login — error YouTube diteruskan apa adanya.
function cleanYtDlpError(raw) {
  return raw.slice(0, 500)
}

// Jalankan dengan retry terbatas (maks MAX_RETRY), tanpa infinite loop.
async function runWithRetry(args, timeoutMs, maxAttempts = MAX_RETRY) {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await runYtDlp(args, timeoutMs)
    } catch (e) {
      lastErr = e
      // Jangan retry untuk error permanen / proteksi YouTube
      if (/not a bot|unavailable|private|deleted|age|format is not available|reloaded/i.test(e.message)) break
      if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  throw lastErr
}

function isUrl(s) {
  return /^https?:\/\//i.test(s)
}

// Cari info video (judul, durasi, thumbnail) tanpa download
export async function ytdlInfo(query) {
  const target = isUrl(query) ? query : `ytsearch1:${query}`
  const json = await runWithRetry(['--dump-single-json', '--skip-download', target], 60000)
  const info = JSON.parse(json)
  const v = info.entries ? info.entries[0] : info
  if (!v || !v.id) throw new Error('Video tidak ditemukan.')
  return {
    id: v.id,
    title: v.title || 'Tanpa judul',
    duration: v.duration || 0,
    uploader: v.uploader || v.channel || '-',
    thumbnail: v.thumbnail || null,
    url: v.webpage_url || `https://www.youtube.com/watch?v=${v.id}`,
  }
}

// Download audio/video, return { filePath, fileName, cleanup }
export async function ytdlDownload(query, format = 'mp3') {
  const info = await ytdlInfo(query)
  const tmp = path.join(os.tmpdir(), `ytdl-${crypto.randomBytes(8).toString('hex')}`)
  fs.mkdirSync(tmp, { recursive: true })

  function cleanup() {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  }

  try {
    const safeTitle = (info.title || 'audio').replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().slice(0, 60) || 'media'
    const isMp3 = format === 'mp3'
    const outTemplate = path.join(tmp, `${safeTitle}.%(ext)s`)

    const maxMb = isMp3 ? MAX_MP3_MB : MAX_MP4_MB

    const args = isMp3
      ? ['-f', 'bestaudio[ext=m4a]/bestaudio/best',
         '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '128K',
         '-o', outTemplate, info.url]
      : ['-f', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
         '--merge-output-format', 'mp4',
         '-o', outTemplate, info.url]

    args.unshift('--socket-timeout', '15', '--retries', '2', '--fragment-retries', '2')
    await runWithRetry(args, 45000, 1)

    const files = fs.readdirSync(tmp).filter((f) => !f.endsWith('.part'))
    if (!files.length) throw new Error('Download gagal: file kosong.')
    const filePath = path.join(tmp, files[0])
    const stat = fs.statSync(filePath)
    if (stat.size > maxMb * 1024 * 1024) {
      throw new Error(`File terlalu besar (${(stat.size / 1048576).toFixed(1)} MB, maks ${maxMb} MB).`)
    }

    return {
      filePath,
      fileName: files[0],
      mimetype: isMp3 ? 'audio/mpeg' : 'video/mp4',
      title: info.title,
      duration: info.duration,
      uploader: info.uploader,
      thumbnail: info.thumbnail,
      url: info.url,
      size: stat.size,
      cleanup,
    }
  } catch (e) {
    cleanup()
    throw e
  }
}

// YouTube Transcript — ambil subtitle/transkrip video YouTube via yt-dlp.
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
//
// GET /api/yttranscript?url= -> { status:true, title, text }

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/(?:watch|shorts|live)|youtu\.be\/)/i.test(url || '')
}

function parseVtt(vtt) {
  const lines = vtt.split('\n')
  const out = []
  let cur = []
  const flush = () => {
    const t = cur.join(' ').replace(/\s+/g, ' ').trim()
    if (t) out.push(t)
    cur = []
  }
  for (const line of lines) {
    const s = line.trim()
    if (!s || s === 'WEBVTT' || /^\d+$/.test(s) || s.includes('-->') || /^NOTE/.test(s)) {
      if (s.includes('-->')) flush()
      continue
    }
    // hapus tag <c>, <00:00:00.000> dsb
    cur.push(s.replace(/<[^>]+>/g, ''))
  }
  flush()
  // dedup baris berulang (auto-sub sering mengulang)
  const dedup = []
  for (const t of out) {
    if (t !== dedup[dedup.length - 1]) dedup.push(t)
  }
  return dedup.join(' ')
}

export async function ytTranscript(url) {
  url = String(url || '').trim()
  if (!url) throw new Error('Parameter ?url= wajib diisi.')
  if (!isYouTubeUrl(url)) throw new Error('URL bukan YouTube yang valid.')

  const dir = await mkdtemp(join(tmpdir(), 'habi-yttr-'))
  try {
    // Ambil subtitle otomatis (prioritas: manual id/en -> auto id/en)
    await execFileAsync('yt-dlp', [
      '--skip-download',
      '--write-sub', '--write-auto-sub',
      '--sub-langs', 'id,en',
      '--sub-format', 'vtt',
      '--no-check-certificate',
      '-o', join(dir, '%(id)s'),
      url,
    ], { timeout: 90000 })

    const files = await readdir(dir)
    const vttFile = files.find((f) => f.endsWith('.vtt'))
    if (!vttFile) throw new Error('Video ini tidak punya subtitle/transkrip.')

    const vtt = await readFile(join(dir, vttFile), 'utf8')
    const text = parseVtt(vtt)
    if (!text) throw new Error('Transkrip kosong.')

    // judul dari nama file
    const title = vttFile.replace(/\.(id|en)\.vtt$/, '').replace(/_/g, ' ')
    return { title, text: text.slice(0, 15000) }
  } catch (e) {
    if (/tidak punya subtitle|Transkrip kosong/.test(e.message)) throw e
    throw new Error(`Gagal ambil transkrip: ${e.message.slice(0, 150)}`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

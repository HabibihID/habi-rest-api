// BratVid engine — renderer video teks animasi (60fps) untuk HABI REST API.
// Kode dari kiriman user 2026-10-21, diadaptasi: output Buffer (bukan file),
// cache font/emoji di tmp. Tema black|white|green, blur 0-3, format mp4|gif,
// render emoji Apple per kata, efek sheen sweep.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'

const HOME = join(tmpdir(), 'habi-bratvid-cache')
mkdirSync(HOME, { recursive: true })

export const DEFAULTS = {
  text: 'YANG INI ANAK BAIK😭🤩',
  theme: 'white', // black | white | green
  blur: 0,        // 0-3
  format: 'mp4',  // mp4 | gif
  hold: 1.5,      // detik frame akhir
  fast: false,     // render beberapa frame sekaligus
}

const FONT_URL = 'https://cdn.jsdelivr.net/gh/Napoleon-Fibonacci/assets@main/font/impact.ttf'
const FONT_FILE = join(HOME, 'impact.ttf')
const EMOJI_SRC = process.env.EMOJI_URL ?? 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/{code}.png'
const EMOJI_DIR = join(HOME, 'emoji-cache')

let fontRegistered = false
const emojiImgCache = new Map()

const PALETTE = { black: ['#000000', '#ffffff'], white: ['#ffffff', '#000000'], green: ['#8ace00', '#000000'] }
const SHEEN = '0:0 .1:.35 .25:.95 .38:.35 .45:.05 .52:.05 .6:.35 .75:.95 .88:.35 1:0'
  .split(' ').map(s => s.split(':').map(Number))

const S = 1000, M = 70, P = 40, BOX = S - 2 * M, GAP = 15, FPS = 60
const LEAD = 0.15, STAGGER = 5, POP = 28, SWEEP = 38, WINDOW = 6

async function download(url, file) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
}

async function loadEmoji(e) {
  mkdirSync(EMOJI_DIR, { recursive: true })
  const base = Array.from(e, ch => ch.codePointAt(0).toString(16).padStart(4, '0')).join('-')
  for (const code of new Set([base, base.replaceAll('-fe0f', '')])) {
    const file = join(EMOJI_DIR, `${code}.png`)
    try {
      if (!existsSync(file)) await download(EMOJI_SRC.replace('{code}', code), file)
      return await loadImage(file)
    } catch { /* coba varian berikutnya */ }
  }
  return null
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const isEmoji = s => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(s)

function toRuns(word) {
  const out = []
  for (const { segment: s } of graphemes.segment(word)) {
    const em = isEmoji(s), tail = out.at(-1)
    if (!em && tail && !tail.em) tail.s += s
    else out.push({ s, em })
  }
  return out
}

const runWidth = (g, runs, fs) => {
  g.font = `${fs}px Impact`
  return runs.reduce((sum, r) => sum + (r.em ? fs : g.measureText(r.s).width), 0)
}

function largest(lo, hi, ok) {
  let best = lo
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ok(mid)) { best = mid; lo = mid + 1 } else hi = mid - 1
  }
  return best
}

function arrange(g, text) {
  const raw = text.split(' ').map(toRuns)
  const maxW = BOX - 2 * P
  const measure = fs => raw.map(r => runWidth(g, r, fs))
  const spaceW = fs => { g.font = `${fs}px Impact`; return g.measureText(' ').width }

  const breakRows = (ws, fs) => {
    const sp = spaceW(fs), rows = [[]]
    let used = 0
    ws.forEach((w, i) => {
      const row = rows.at(-1)
      if (row.length && used + sp + w > maxW) { rows.push([i]); used = w }
      else { used = row.length ? used + sp + w : w; row.push(i) }
    })
    return rows
  }

  const fs = largest(10, 700, size => {
    const ws = measure(size)
    return Math.max(...ws) <= maxW && breakRows(ws, size).length * (size + GAP) - GAP <= maxW
  })

  const ws = measure(fs), rows = breakRows(ws, fs), sp = spaceW(fs)
  let y = M + (BOX - (rows.length * (fs + GAP) - GAP)) / 2
  const words = []
  rows.forEach((row, ri) => {
    const stretch = ri < rows.length - 1 && row.length > 1
    const gap = stretch ? (maxW - row.reduce((a, i) => a + ws[i], 0)) / (row.length - 1) : sp
    let x = M + P
    for (const i of row) {
      words.push({ runs: raw[i], w: ws[i], x, y })
      x += ws[i] + gap
    }
    y += fs + GAP
  })
  return { fs, words }
}

const back = (t, k = 1.4) => { const u = t - 1; return 1 + u * u * ((k + 1) * u + k) }
const HIDE = { on: false, scale: 0, alpha: 0 }
const FULL = { on: true, scale: 1, alpha: 1 }

function popPose(k) {
  if (k < 0) return HIDE
  if (k >= POP) return FULL
  const p = k / (POP - 1)
  return { on: true, scale: 0.2 + 0.8 * back(p), alpha: Math.min(1, p * 1.8) }
}

function* timeline(count, holdSec) {
  yield { pose: () => HIDE, sheen: 0, repeat: Math.round(LEAD * FPS) }
  const pops = (count - 1) * STAGGER + POP
  for (let f = 0; f < pops; f++) yield { pose: i => popPose(f - i * STAGGER), sheen: (f + 1) / pops, repeat: 1 }
  for (let k = 1; k <= SWEEP; k++) yield { pose: () => FULL, sheen: k / SWEEP, repeat: 1 }
  yield { pose: () => FULL, sheen: 0, repeat: Math.round(holdSec * FPS) }
}

function drawFrame({ fs, words }, pics, { theme, blur, gif }, { pose, sheen }) {
  const [bg, fg] = PALETTE[theme] ?? PALETTE.white
  const cv = createCanvas(S, S)
  const g = cv.getContext('2d')
  g.fillStyle = bg
  gif ? g.fillRect(M, M, BOX, BOX) : g.fillRect(0, 0, S, S)

  g.beginPath()
  g.rect(M, M, BOX, BOX)
  g.clip()
  g.fillStyle = fg
  g.font = `${fs}px Impact`
  g.textAlign = 'left'
  g.textBaseline = 'top'
  if (blur > 0) g.filter = `blur(${blur}px)`

  words.forEach((w, i) => {
    const { on, scale, alpha } = pose(i)
    if (!on) return
    const cx = w.x + w.w / 2, cy = w.y + fs / 2
    g.globalAlpha = Math.max(0, Math.min(1, alpha))
    g.setTransform(scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale))
    let x = w.x
    for (const r of w.runs) {
      const img = r.em && pics.get(r.s)
      if (img) g.drawImage(img, x, w.y, fs, fs)
      else g.fillText(r.s, x, w.y)
      x += r.em ? fs : g.measureText(r.s).width
    }
  })
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = 1

  if (sheen > 0 && sheen <= 1) {
    const a = M + BOX * (2.8 * sheen - 1)
    const grad = g.createLinearGradient(a, a, a + BOX * 0.95, a + BOX * 0.95)
    for (const [pos, op] of SHEEN) grad.addColorStop(pos, `rgba(255,255,255,${op})`)
    g.fillStyle = grad
    g.fillRect(M, M, BOX, BOX)
  }
  return cv
}

async function* inOrder(items, work, width) {
  const queue = []
  for (const it of items) {
    queue.push(work(it))
    if (queue.length >= width) yield await queue.shift()
  }
  while (queue.length) yield await queue.shift()
}

function openEncoder(out, gif) {
  const vf = gif
    ? 'fps=60,scale=1000:1000:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer'
    : 'fps=60,scale=1000:1000'
  const tail = gif
    ? ['-loop', '0']
    : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  const proc = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', '-', '-vf', vf, ...tail, out],
    { stdio: ['pipe', 'ignore', 'pipe'] })
  let log = ''
  proc.stderr.on('data', d => { log += d })
  proc.stdin.on('error', () => {})
  const done = new Promise((ok, fail) => {
    proc.on('error', fail)
    proc.on('close', code => (code === 0 ? ok() : fail(new Error(`ffmpeg gagal (${code}): ${log.slice(-300)}`))))
  })
  const push = buf => new Promise(ok => proc.stdin.write(buf, () => ok()))
  return { push, finish: () => { proc.stdin.end(); return done } }
}

export async function makeBrat(opts = {}) {
  const c = { ...DEFAULTS, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null)) }
  const cfg = { theme: c.theme, blur: [0, 1, 2, 3].includes(c.blur) ? c.blur : 0, gif: c.format === 'gif' }
  const text = String(c.text).trim().split(/\s+/).filter(Boolean).join(' ')
  if (!text) throw new Error('Teks kosong')

  if (!fontRegistered) {
    if (!existsSync(FONT_FILE)) await download(FONT_URL, FONT_FILE)
    GlobalFonts.registerFromPath(FONT_FILE, 'Impact')
    fontRegistered = true
  }

  const plan = arrange(createCanvas(S, S).getContext('2d'), text)
  const emojis = new Set(plan.words.flatMap(w => w.runs.filter(r => r.em).map(r => r.s)))
  const pics = new Map()
  for (const e of emojis) {
    if (!emojiImgCache.has(e)) emojiImgCache.set(e, await loadEmoji(e))
    pics.set(e, emojiImgCache.get(e))
  }

  const hold = Math.max(0, Number(c.hold) || 0)
  const out = join(HOME, `brat-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${cfg.gif ? 'gif' : 'mp4'}`)
  const enc = openEncoder(out, cfg.gif)

  const job = async step => [await drawFrame(plan, pics, cfg, step).encode('png'), step.repeat]
  try {
    for await (const [png, repeat] of inOrder(timeline(plan.words.length, hold), job, c.fast ? WINDOW : 1)) {
      for (let n = 0; n < repeat; n++) await enc.push(png)
    }
  } catch (e) {
    await enc.finish().catch(() => {})
    try { unlinkSync(out) } catch {}
    throw e
  }
  await enc.finish()
  const buffer = readFileSync(out)
  try { unlinkSync(out) } catch {}
  return buffer
}

export async function makeBratImage(opts = {}) {
  const c = { ...DEFAULTS, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null)) }
  const cfg = { theme: ['black', 'white', 'green'].includes(c.theme) ? c.theme : 'white', blur: [0, 1, 2, 3].includes(c.blur) ? c.blur : 0, gif: false }
  const text = String(c.text).trim().split(/\s+/).filter(Boolean).join(' ')
  if (!text) throw new Error('Teks kosong')

  if (!fontRegistered) {
    if (!existsSync(FONT_FILE)) await download(FONT_URL, FONT_FILE)
    GlobalFonts.registerFromPath(FONT_FILE, 'Impact')
    fontRegistered = true
  }

  const plan = arrange(createCanvas(S, S).getContext('2d'), text)
  const emojis = new Set(plan.words.flatMap(w => w.runs.filter(r => r.em).map(r => r.s)))
  const pics = new Map()
  for (const em of emojis) {
    if (!emojiImgCache.has(em)) emojiImgCache.set(em, await loadEmoji(em))
    pics.set(em, emojiImgCache.get(em))
  }
  const cv = drawFrame(plan, pics, cfg, { pose: () => FULL, sheen: 0 })
  return cv.encode('png')
}

export default { makeBrat }

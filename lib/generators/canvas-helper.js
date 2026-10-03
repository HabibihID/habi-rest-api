// Shared helper untuk canvas ala ditzzzx
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Asset lokal — tidak tergantung GitHub pihak ketiga
export function localAsset(filename) {
  return join(__dirname, '..', '..', 'assets', 'canvas', filename)
}

const ASSETS_DIR = join(tmpdir(), 'habi-canvas-assets')
const FONTS_DIR = join(ASSETS_DIR, 'fonts')

async function downloadFile(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`Download gagal: ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function ensureFont(url, name, family) {
  await mkdir(FONTS_DIR, { recursive: true })
  const fPath = join(FONTS_DIR, name)
  let valid = false
  if (existsSync(fPath)) {
    const s = await stat(fPath)
    if (s.size > 2000) valid = true
  }
  if (!valid) {
    const buf = await downloadFile(url)
    await writeFile(fPath, buf)
  }
  try {
    GlobalFonts.registerFromPath(fPath, family)
  } catch {}
  return family
}

export async function ensureInter() {
  const base = 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2'
  await ensureFont(base, 'Inter-900.woff2', 'InterBlack')
  await ensureFont(base, 'Inter-700.woff2', 'InterBold')
  await ensureFont(base, 'Inter-500.woff2', 'InterMedium')
  return { black: 'InterBlack', bold: 'InterBold', medium: 'InterMedium' }
}

export async function loadBg(urlOrPath, name) {
  // Kalau sudah path lokal (dari localAsset), langsung load
  if (urlOrPath.startsWith('/')) {
    return loadImage(urlOrPath)
  }
  await mkdir(ASSETS_DIR, { recursive: true })
  const p = join(ASSETS_DIR, name)
  if (!existsSync(p)) {
    const buf = await downloadFile(urlOrPath)
    await writeFile(p, buf)
  }
  return loadImage(p)
}

export { createCanvas, loadImage }

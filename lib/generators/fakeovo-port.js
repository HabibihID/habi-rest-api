// Fake OVO — port dari ditzzzx
import { createCanvas, loadImage, localAsset } from './canvas-helper.js'
import { GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const FONT_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf'

async function ensureOvoFont() {
  const dir = join(tmpdir(), 'habi-canvas-assets', 'fonts')
  await mkdir(dir, { recursive: true })
  const p = join(dir, 'OVO-600.ttf')
  if (!existsSync(p)) {
    const r = await fetch(FONT_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    await writeFile(p, Buffer.from(await r.arrayBuffer()))
  }
  try { GlobalFonts.registerFromPath(p, 'OVOFont') } catch {}
}

function formatAmount(input) {
  const digits = String(input).replace(/[^\d]/g, '') || '0'
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export async function fakeOvoPort(nominal) {
  await ensureOvoFont()
  const bgImg = await loadImage(localAsset('file_0000000078bc71fa87da5cf26dc6c008.jpeg'))

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  const amount = formatAmount(nominal)

  // "Rp" label
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '800 20px OVOFont, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Rp', 61, 368)

  // Nominal
  ctx.font = '800 28px OVOFont, sans-serif'
  ctx.fillText(amount, 94, 371)

  return Buffer.from(await canvas.encode('png'))
}

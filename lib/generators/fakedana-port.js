// Fake DANA / OVO — port dari ditzzzx
import { createCanvas, loadImage, ensureInter, loadBg, localAsset } from './canvas-helper.js'
import { GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const DANA_BG = localAsset('fkedana.png')
const DANA_EYE = localAsset('IMG-20260726-WA1031.jpg')
const DANA_FONT = 'https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf'

async function ensureDanaFont() {
  const dir = join(tmpdir(), 'habi-canvas-assets', 'fonts')
  await mkdir(dir, { recursive: true })
  const p = join(dir, 'DANA-600.ttf')
  if (!existsSync(p)) {
    const r = await fetch(DANA_FONT, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    await writeFile(p, Buffer.from(await r.arrayBuffer()))
  }
  try { GlobalFonts.registerFromPath(p, 'DANA') } catch {}
}

export async function fakeDanaPort(nominal) {
  await ensureDanaFont()
  const bgImg = await loadBg(DANA_BG, 'fakedana-bg.png')
  const eyeImg = await loadBg(DANA_EYE, 'fakedana-eye.jpg')

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  const valX = 138, valY = 52, maxFontSize = 37
  let fs = maxFontSize
  const maxW = canvas.width - valX - 100
  ctx.font = `600 ${fs}px DANA`
  while (ctx.measureText(nominal).width > maxW && fs > 16) {
    fs -= 2
    ctx.font = `600 ${fs}px DANA`
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(nominal, valX, valY)

  const eyeH = fs * 1.3
  const eyeW = (eyeImg.width / eyeImg.height) * eyeH
  ctx.drawImage(eyeImg, valX + ctx.measureText(nominal).width + 7, valY + (fs - eyeH) / 2, eyeW, eyeH)

  return Buffer.from(await canvas.encode('png'))
}

// TTQC — TikTok Quote Chat (port dari ditzzzx)
import { createCanvas, loadImage, localAsset } from './canvas-helper.js'
import { GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const FONT_URLS = {
  'PlusJakartaSans-Regular.ttf': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf',
  'PlusJakartaSans-Medium.ttf': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf',
  'PlusJakartaSans-Bold.ttf': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf',
}

async function ensureFonts() {
  const dir = join(tmpdir(), 'habi-canvas-assets', 'fonts')
  await mkdir(dir, { recursive: true })
  for (const [file, url] of Object.entries(FONT_URLS)) {
    const p = join(dir, file)
    if (!existsSync(p)) {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      await writeFile(p, Buffer.from(await r.arrayBuffer()))
    }
    try { GlobalFonts.registerFromPath(p, 'Plus Jakarta Sans') } catch {}
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/(\s+)/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!w || (w.trim() === '' && cur === '')) continue
    const test = cur + w
    if (ctx.measureText(test).width > maxWidth) {
      if (cur) { lines.push(cur.trimEnd()); cur = w.trimStart() }
      else { lines.push(test); cur = '' }
    } else cur = test
  }
  if (cur.trim()) lines.push(cur.trimEnd())
  return lines
}

export async function ttqcPort(username, chatText, avatarUrl = null) {
  await ensureFonts()
  const template = await loadImage(localAsset('qyzwa.png'))

  let avatarImg = null
  if (avatarUrl) {
    try {
      const r = await fetch(avatarUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      avatarImg = await loadImage(Buffer.from(await r.arrayBuffer()))
    } catch {}
  }

  const canvas = createCanvas(1080 * 2, 2280 * 2)
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  ctx.drawImage(template, 0, 0, 1080, 2280)

  // Avatar top
  if (avatarImg) {
    ctx.save()
    ctx.beginPath(); ctx.arc(183, 83, 42, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatarImg, 183 - 42, 83 - 42, 84, 84)
    ctx.restore()
  }

  // Username
  ctx.font = `bold 34px 'Plus Jakarta Sans'`
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(username, 250, 82)

  // Chat bubble
  ctx.font = `500 30px 'Plus Jakarta Sans'`
  const lines = wrapText(ctx, chatText, 520 - 52)
  const lineH = 30 * 1.45
  let maxW = 0
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width)

  const padX = 30, padY = 24
  const bw = Math.max(maxW + padX * 2, 180)
  const bh = lines.length * lineH + padY * 2
  const bx = 175 - padX, by = 962 - padY

  // Bubble
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 35)
  ctx.fill()

  // Avatar chat
  if (avatarImg) {
    ctx.save()
    ctx.beginPath(); ctx.arc(75, by + bh / 2, 38, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatarImg, 75 - 38, by + bh / 2 - 38, 76, 76)
    ctx.restore()
  }

  // Text
  ctx.fillStyle = '#161823'
  lines.forEach((line, i) => {
    ctx.fillText(line, 175, 962 + i * lineH + 15)
  })

  return Buffer.from(await canvas.encode('png'))
}

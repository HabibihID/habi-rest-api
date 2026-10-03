// IGQC — Instagram Quote Chat (port dari ditzzzx)
import { createCanvas, loadImage, ensureInter, localAsset } from './canvas-helper.js'

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

export async function igqcPort(text, username = 'User', ppBuffer = null) {
  await ensureInter()
  const bgImg = await loadImage(localAsset('igqc.png'))

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  // Chat bubble area (posisi dari template)
  const bubbleX = 100, maxW = 600
  ctx.font = '30px Inter, sans-serif'
  const lines = wrapText(ctx, text, maxW)
  const lineH = 44
  const bh = lines.length * lineH + 40
  const by = canvas.height * 0.45 - bh / 2

  // Bubble putih
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(bubbleX, by, maxW + 60, bh, 24)
  ctx.fill()

  // Text
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'left'
  lines.forEach((line, i) => {
    ctx.fillText(line, bubbleX + 30, by + 40 + i * lineH)
  })

  // Username di atas bubble
  ctx.font = 'bold 28px Inter, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText(username, bubbleX + 30, by - 20)

  return Buffer.from(await canvas.encode('png'))
}

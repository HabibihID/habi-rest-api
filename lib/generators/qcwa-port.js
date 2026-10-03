// QCWA — Quote WhatsApp ala ditzzzx (simplified high-quality)
import { createCanvas, loadImage, ensureInter, loadBg } from './canvas-helper.js'

const BG_DARK = 'https://cdn.jsdelivr.net/gh/Ditzzx-vibecoder/Assets@main/Image/hoh.jpeg'
const BG_LIGHT = 'https://cdn.jsdelivr.net/gh/Ditzzx-vibecoder/Assets@main/Font/sisis.jpeg'

export async function qcwaGen(text, author = 'Anonymous', mode = 'dark') {
  await ensureInter()
  const bgImg = await loadBg(mode === 'light' ? BG_LIGHT : BG_DARK, `waquote-${mode}.jpg`)

  const W = 800
  // Hitung tinggi berdasarkan teks
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = (line + ' ' + w).trim()
    if (test.length > 40) {
      if (line) lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)

  const H = 250 + lines.length * 36
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Background (cover)
  const scale = Math.max(W / bgImg.width, H / bgImg.height)
  const sw = bgImg.width * scale, sh = bgImg.height * scale
  ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh)

  const isDark = mode === 'dark'
  const bubbleColor = isDark ? '#005c4b' : '#ffffff'
  const textColor = isDark ? '#e9edef' : '#2f3032'

  // Bubble
  const bx = 40, by = 60, bw = W - 80, bh = H - 120
  ctx.fillStyle = bubbleColor
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 15)
  ctx.fill()

  // Author
  ctx.fillStyle = '#25d366'
  ctx.font = '700 22px InterBold, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(author, bx + 25, by + 45)

  // Text
  ctx.fillStyle = textColor
  ctx.font = '400 20px InterMedium, sans-serif'
  lines.forEach((l, i) => {
    ctx.fillText(l, bx + 25, by + 85 + i * 36)
  })

  // Time
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  ctx.fillStyle = isDark ? '#aeb4b8' : '#767a7b'
  ctx.font = '400 14px InterMedium, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${timeStr} ✓✓`, bx + bw - 20, by + bh - 15)

  return Buffer.from(await canvas.encode('png'))
}

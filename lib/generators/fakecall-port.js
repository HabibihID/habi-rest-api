// Fake Call iOS — port simplified (background asli)
import { createCanvas, loadImage, ensureInter, loadBg, localAsset } from './canvas-helper.js'

export async function fakeCallPort(nama, ppBuffer = null) {
  await ensureInter()
  const bgImg = await loadImage(localAsset('353dc125-a39c-4d27-9ba5-9ec7dfa6624a.png'))

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  // PP
  const ppX = canvas.width / 2, ppY = canvas.height * 0.50, ppR = canvas.width * 0.22
  if (ppBuffer) {
    try {
      const ppImg = await loadImage(ppBuffer)
      ctx.save()
      ctx.beginPath()
      ctx.arc(ppX, ppY, ppR, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(ppImg, ppX - ppR, ppY - ppR, ppR * 2, ppR * 2)
      ctx.restore()
    } catch {}
  }

  // Nama (di bawah PP, posisi dari background)
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.font = '700 48px InterBold, sans-serif'
  // Auto-shrink
  let fs = 48
  while (ctx.measureText(nama).width > canvas.width * 0.8 && fs > 20) {
    fs -= 2
    ctx.font = `700 ${fs}px InterBold, sans-serif`
  }
  ctx.fillText(nama, canvas.width / 2, canvas.height * 0.72)

  return Buffer.from(await canvas.encode('png'))
}

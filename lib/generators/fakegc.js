// Fake GC iOS — port dari ditzzzx
import { createCanvas, loadImage, ensureInter, loadBg } from './canvas-helper.js'

const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/IMG-20260825-WA0312.jpg'

export async function fakeGcIosGen(nama, anggota, ppBuffer = null) {
  await ensureInter()
  const bgImg = await loadBg(BG_URL, 'bg_fakegc.jpg')

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  // PP
  if (ppBuffer) {
    try {
      const ppImg = await loadImage(ppBuffer)
      ctx.save()
      ctx.beginPath()
      ctx.arc(538, 362, 162, 0, Math.PI * 2, true)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(ppImg, 538 - 162, 362 - 162, 324, 324)
      ctx.restore()
    } catch {}
  }

  // Nama GC
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 64px InterBlack, sans-serif'
  // Auto-shrink jika kepanjangan
  let fs = 64
  while (ctx.measureText(nama).width > 900 && fs > 20) {
    fs -= 2
    ctx.font = `900 ${fs}px InterBlack, sans-serif`
  }
  ctx.fillText(nama, 540, 602)

  // Anggota
  const prefixText = 'Grup • '
  ctx.font = '500 37px InterMedium, sans-serif'
  const prefixWidth = ctx.measureText(prefixText).width
  const totalWidth = prefixWidth + ctx.measureText(anggota).width
  const startX = 548 - totalWidth / 2

  ctx.fillStyle = '#8E8E93'
  ctx.textAlign = 'left'
  ctx.fillText(prefixText, startX, 684)
  ctx.fillStyle = '#34C759'
  ctx.fillText(anggota, startX + prefixWidth, 684)

  return Buffer.from(await canvas.encode('png'))
}

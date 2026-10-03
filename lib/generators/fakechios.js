// Fake CH iOS — port dari ditzzzx (Rin imup)
import { createCanvas, loadImage, ensureInter, loadBg, localAsset } from './canvas-helper.js'

const BG_URL = localAsset('153a185e-f1de-4078-8042-fdfc56592c3d.png')

export async function fakeChIosGen(nama, pengikut, jam, ppBuffer = null) {
  await ensureInter()
  const bgImg = await loadBg(BG_URL, 'bg_fakech.png')

  const canvas = createCanvas(bgImg.width, bgImg.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

  const config = {
    pp: { x: 585, y: 622, r: 213 },
    nama: { y: 908, maxSize: 68, maxWidth: 1000 },
    pengikut: { y: 995, size: 45 },
    jam: { x: 116, y: 63, size: 43 }
  }

  // PP (jika ada, jika tidak skip atau pakai default)
  if (ppBuffer) {
    try {
      const ppImg = await loadImage(ppBuffer)
      ctx.save()
      ctx.beginPath()
      ctx.arc(config.pp.x, config.pp.y, config.pp.r, 0, Math.PI * 2, true)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(ppImg, config.pp.x - config.pp.r, config.pp.y - config.pp.r, config.pp.r * 2, config.pp.r * 2)
      ctx.restore()
    } catch {}
  }

  // Nama
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let fontSize = config.nama.maxSize
  ctx.font = `900 ${fontSize}px InterBlack, sans-serif`
  while (ctx.measureText(nama).width > config.nama.maxWidth && fontSize > 14) {
    fontSize -= 2
    ctx.font = `900 ${fontSize}px InterBlack, sans-serif`
  }
  ctx.fillText(nama, canvas.width / 2, config.nama.y)

  // Pengikut
  ctx.fillStyle = '#8E8E93'
  ctx.font = `500 ${config.pengikut.size}px InterMedium, sans-serif`
  ctx.fillText(`${pengikut} pengikut`, canvas.width / 2, config.pengikut.y)

  // Jam
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${config.jam.size}px InterBold, sans-serif`
  ctx.fillText(jam, config.jam.x, config.jam.y)

  return Buffer.from(await canvas.encode('png'))
}

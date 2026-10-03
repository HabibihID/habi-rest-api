// IQC2 API — Pink iPhone Quote Card (kode sendiri, aset sendiri).
// Ditulis dari nol untuk HABI AI. Tidak tergantung website orang lain.
//
// Aset di-host di github.com/HabibihID/habi-rest-api/assets/iqc/
//
// Cara pakai:
//   .iqc2 halo dunia
//   .iqc2 teks | https://url-gambar.jpg (custom background)

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

const GH = 'https://raw.githubusercontent.com/HabibihID/habi-rest-api/main/assets'
const ASSETS = {
  fontReg: `${GH}/iqc/SF-Regular.otf`,
  fontBold: `${GH}/iqc/SF-Bold.otf`,
  fontSemi: `${GH}/iqc/SF-Semibold.otf`,
  bgPink: `${GH}/iqc/bg-pink.png`,
  bubbleImg: `${GH}/iqc/bubble-watercolor.jpg`,
  emoji: `${GH}/quoteimg/emoji-apple.json`,
}
const CACHE = join(os.tmpdir(), 'habi-iqc2')

let ready = false
let emojiMap = null
const emojiCache = new Map()

async function dl(url, dest) {
  if (existsSync(dest)) return dest
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(90000) })
  if (!r.ok) throw new Error(`Gagal download aset: ${r.status}`)
  await mkdir(join(dest, '..'), { recursive: true }).catch(() => {})
  await writeFile(dest, Buffer.from(await r.arrayBuffer()))
  return dest
}

async function init() {
  if (ready) return
  await mkdir(CACHE, { recursive: true }).catch(() => {})
  const [reg, bold, semi] = await Promise.all([
    dl(ASSETS.fontReg, join(CACHE, 'SF-Reg.otf')),
    dl(ASSETS.fontBold, join(CACHE, 'SF-Bold.otf')),
    dl(ASSETS.fontSemi, join(CACHE, 'SF-Semi.otf')),
  ])
  try {
    GlobalFonts.registerFromPath(reg, 'HabiReg')
    GlobalFonts.registerFromPath(bold, 'HabiBold')
    GlobalFonts.registerFromPath(semi, 'HabiSemi')
  } catch {}
  try {
    const ep = await dl(ASSETS.emoji, join(CACHE, 'emoji.json'))
    emojiMap = JSON.parse(await readFile(ep, 'utf-8'))
  } catch { emojiMap = {} }
  ready = true
}

const eKey = e => [...e].map(c => c.codePointAt(0).toString(16)).join('-')

async function paintEmoji(ctx, emoji, cx, cy, size) {
  try {
    if (!emojiMap) {
      const ep = await dl(ASSETS.emoji, join(CACHE, 'emoji.json'))
      emojiMap = JSON.parse(await readFile(ep, 'utf-8'))
    }
    const k = eKey(emoji)
    const b64 = emojiMap[k] || emojiMap[k.replace(/-fe0f/g, '')]
    if (b64) {
      const ck = `${k}-${size}`
      let img = emojiCache.get(ck)
      if (!img) {
        img = await loadImage(Buffer.from(b64, 'base64'))
        emojiCache.set(ck, img)
      }
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
      return
    }
  } catch {}
  ctx.save()
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, cx, cy)
  ctx.restore()
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx, text, maxW, font) {
  ctx.font = font
  const out = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word
      if (ctx.measureText(t).width <= maxW || !line) line = t
      else { out.push(line); line = word }
    }
    out.push(line)
    if (out.length >= 14) break
  }
  const res = out.slice(0, 14)
  if (out.length > 14 || String(text).length > res.join(' ').length) res[res.length - 1] += '…'
  return res
}

export async function buildIqc2(text, customBg) {
  await init()
  const W = 590, H = 1280
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const F = (s, w = 'Reg') => `${s}px Habi${w}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`

  // --- Background ---
  try {
    const src = customBg || ASSETS.bgPink
    const rb = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
    const bbuf = Buffer.from(await rb.arrayBuffer())
    const tmpBg = join(CACHE, 'bg-tmp.png')
    await writeFile(tmpBg, bbuf)
    const bg = await loadImage(tmpBg)
    const sc = Math.max(W / bg.width, H / bg.height)
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc)
  } catch (e) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#f6eef2'); g.addColorStop(0.5, '#fbe4ee'); g.addColorStop(1, '#fddbe9')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }

  // --- Status bar ---
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`
  ctx.fillStyle = '#000'
  ctx.font = F(24, 'Bold'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(hm, 80, 40)

  const bhs = [6.6, 9.8, 14, 18], bxs = [419.6, 427.9, 436.2, 444.5]
  for (let i = 0; i < 4; i++) { rrect(ctx, bxs[i], 48.4 - bhs[i], 4.8, bhs[i], 1.3); ctx.fill() }
  ctx.font = F(19, 'Bold'); ctx.fillText('4G', 458, 44)

  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5
  rrect(ctx, 497, 31, 37, 17, 5.5); ctx.stroke()
  ctx.fillStyle = '#000'
  rrect(ctx, 499.6, 33.2, 16, 13.1, 4); ctx.fill()

  // --- Bubble chat (gambar + teks) ---
  const bx = 18, by = 280
  const bw = 380
  let bubImg = null
  try {
    const ib = await fetch(customBg || ASSETS.bubbleImg, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
    const ibuf = Buffer.from(await ib.arrayBuffer())
    const tmpI = join(CACHE, 'bub-tmp.png')
    await writeFile(tmpI, ibuf)
    bubImg = await loadImage(tmpI)
  } catch {}

  const imgH = 380
  const lines = wrap(ctx, text, bw - 40, F(22, 'Reg'))
  const lh = 29
  const textH = lines.length * lh + 30
  const bh = imgH + textH + 25

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.06)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
  ctx.fillStyle = '#fff'
  rrect(ctx, bx, by, bw, bh, 20); ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(bx + 12, by + bh - 20)
  ctx.quadraticCurveTo(bx - 2, by + bh - 4, bx - 8, by + bh)
  ctx.quadraticCurveTo(bx + 6, by + bh, bx + 22, by + bh - 2)
  ctx.closePath(); ctx.fill()

  if (bubImg) {
    ctx.save()
    rrect(ctx, bx + 8, by + 8, bw - 16, imgH, 14)
    ctx.clip()
    const sc2 = Math.max((bw - 16) / bubImg.width, imgH / bubImg.height)
    const dw = bubImg.width * sc2, dh = bubImg.height * sc2
    ctx.drawImage(bubImg, bx + 8 + (bw - 16 - dw) / 2, by + 8 + (imgH - dh) / 2, dw, dh)
    ctx.restore()
  }

  ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  for (let i = 0; i < lines.length; i++) {
    ctx.font = F(22, 'Reg')
    ctx.fillText(lines[i], bx + 18, by + imgH + 25 + i * lh)
  }
  ctx.fillStyle = '#8e8e93'; ctx.font = F(15); ctx.textAlign = 'right'
  ctx.fillText(hm, bx + bw - 14, by + bh - 14)

  // --- Bar reaksi emoji ---
  const reacts = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🌺']
  const pillY = by - 86
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fff'
  rrect(ctx, 22, pillY, 500, 76, 38); ctx.fill()
  ctx.restore()
  const xs = [57, 116, 175, 234, 293, 352, 407]
  for (let i = 0; i < reacts.length; i++) await paintEmoji(ctx, reacts[i], xs[i], pillY + 38, 43)

  ctx.fillStyle = '#e8e8e8'
  ctx.beginPath(); ctx.arc(470, pillY + 38, 22, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#8e8e93'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(470, pillY + 30); ctx.lineTo(470, pillY + 46)
  ctx.moveTo(462, pillY + 38); ctx.lineTo(478, pillY + 38)
  ctx.stroke()

  // --- Menu konteks ---
  const my = by + bh + 15, mw = 342, mh = 380
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  rrect(ctx, 22, my, mw, mh, 36); ctx.fill()
  ctx.restore()

  function iconReply(x, y, s, col) {
    ctx.save(); ctx.translate(x - s/2, y - s/2); ctx.scale(s/24, s/24)
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(11, 5); ctx.lineTo(4, 11); ctx.lineTo(11, 17); ctx.lineTo(11, 14)
    ctx.bezierCurveTo(16, 14, 19, 16, 20, 20)
    ctx.bezierCurveTo(20, 13, 16, 10, 11, 9.5)
    ctx.closePath(); ctx.stroke()
    ctx.restore()
  }

  function iconFwd(x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1)
    ctx.translate(-s/2, -s/2); ctx.scale(s/24, s/24)
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(11, 5); ctx.lineTo(4, 11); ctx.lineTo(11, 17); ctx.lineTo(11, 14)
    ctx.bezierCurveTo(16, 14, 19, 16, 20, 20)
    ctx.bezierCurveTo(20, 13, 16, 10, 11, 9.5)
    ctx.closePath(); ctx.stroke()
    ctx.restore()
  }

  function iconCopy(x, y, s, col) {
    ctx.save(); ctx.translate(x - s/2, y - s/2); ctx.scale(s/24, s/24)
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(9, 4); ctx.lineTo(16, 4); ctx.quadraticCurveTo(18, 4, 18, 6); ctx.lineTo(18, 16)
    ctx.stroke()
    ctx.beginPath()
    const fx=5, fy=8, fw=10, fh=12, fr=2
    ctx.moveTo(fx+fr, fy); ctx.lineTo(fx+fw-fr, fy); ctx.quadraticCurveTo(fx+fw, fy, fx+fw, fy+fr)
    ctx.lineTo(fx+fw, fy+fh-fr); ctx.quadraticCurveTo(fx+fw, fy+fh, fx+fw-fr, fy+fh)
    ctx.lineTo(fx+fr, fy+fh); ctx.quadraticCurveTo(fx, fy+fh, fx, fy+fh-fr)
    ctx.lineTo(fx, fy+fr); ctx.quadraticCurveTo(fx, fy, fx+fr, fy)
    ctx.stroke()
    ctx.restore()
  }

  function iconStar(x, y, s, col) {
    ctx.save(); ctx.translate(x, y)
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'
    ctx.beginPath()
    const outer = s * 0.42, inner = s * 0.18
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath(); ctx.stroke()
    ctx.restore()
  }

  function iconTrash(x, y, s, col) {
    ctx.save(); ctx.translate(x - s/2, y - s/2); ctx.scale(s/24, s/24)
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(10, 5); ctx.lineTo(10, 4); ctx.quadraticCurveTo(10, 3, 11, 3); ctx.lineTo(13, 3)
    ctx.quadraticCurveTo(14, 3, 14, 4); ctx.lineTo(14, 5)
    ctx.stroke()
    ctx.beginPath(); ctx.moveTo(5, 6); ctx.lineTo(19, 6); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(7, 6); ctx.lineTo(8, 19); ctx.quadraticCurveTo(8.1, 20.5, 9.5, 20.5)
    ctx.lineTo(14.5, 20.5); ctx.quadraticCurveTo(15.9, 20.5, 16, 19); ctx.lineTo(17, 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(10, 9); ctx.lineTo(10.5, 17)
    ctx.moveTo(14, 9); ctx.lineTo(13.5, 17)
    ctx.stroke()
    ctx.restore()
  }

  function iconMore(x, y, s, col) {
    ctx.save(); ctx.translate(x, y)
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, s*0.4, 0, Math.PI * 2); ctx.stroke()
    for (const dx of [-s*0.18, 0, s*0.18]) {
      ctx.beginPath(); ctx.arc(dx, 0, s*0.04, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  const rows = [
    [iconReply, 'Balas', '#000'],
    [iconFwd, 'Teruskan', '#000'],
    [iconCopy, 'Salin', '#000'],
    [iconStar, 'Beri bintang', '#000'],
    [iconTrash, 'Hapus', '#c10b27'],
  ]
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  for (let i = 0; i < rows.length; i++) {
    const [fn, label, col] = rows[i]
    const ry = my + 42 + i * 55
    fn(71, ry, 22, col)
    ctx.fillStyle = col; ctx.font = F(23, 'Semi')
    ctx.fillText(label, 105, ry)
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(55, my + 320); ctx.lineTo(332, my + 320); ctx.stroke()
  iconMore(71, my + 352, 22, '#000')
  ctx.fillStyle = '#000'; ctx.font = F(23, 'Semi')
  ctx.fillText('Lainnya...', 105, my + 352)

  return cv.toBuffer('image/png')
}


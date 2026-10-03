// Kalender — port dari ditzzzx (versi canvas)
import { createCanvas, loadImage, ensureInter } from './canvas-helper.js'

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const NAMA_HARI = ['SEN','SEL','RAB','KAM','JUM','SAB','MIN']

const LIBUR = {
  '1-1': 'Tahun Baru Masehi', '5-1': 'Hari Buruh', '8-17': 'Hari Kemerdekaan RI',
  '12-25': 'Hari Raya Natal', '3-21': 'Idul Fitri 1447 H', '3-22': 'Idul Fitri 1447 H',
}

export async function kalenderPort(bulan, tahun) {
  await ensureInter()
  const b = parseInt(bulan) || (new Date().getMonth() + 1)
  const t = parseInt(tahun) || new Date().getFullYear()

  const W = 800, H = 900
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Background krem
  ctx.fillStyle = '#FBF6EC'
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = '#A6192E'
  ctx.fillRect(0, 0, W, 140)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 48px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${NAMA_BULAN[b-1]} ${t}`, W/2, 85)

  // Hari
  ctx.font = 'bold 24px Inter, sans-serif'
  const cellW = W / 7
  NAMA_HARI.forEach((h, i) => {
    ctx.fillStyle = i === 6 ? '#B5473E' : '#221A17'
    ctx.fillText(h, cellW * i + cellW/2, 180)
  })

  // Tanggal
  const firstDay = new Date(t, b-1, 1).getDay()
  const daysInMonth = new Date(t, b, 0).getDate()
  // Adjust: Senin=0
  const startOffset = (firstDay + 6) % 7

  ctx.font = '28px Inter, sans-serif'
  let day = 1
  for (let row = 0; row < 6 && day <= daysInMonth; row++) {
    for (let col = 0; col < 7 && day <= daysInMonth; col++) {
      if (row === 0 && col < startOffset) continue
      const x = cellW * col + cellW/2
      const y = 240 + row * 90
      const isSunday = col === 6
      const isHoliday = LIBUR[`${b}-${day}`]

      if (isSunday || isHoliday) ctx.fillStyle = '#B5473E'
      else ctx.fillStyle = '#221A17'

      ctx.fillText(String(day), x, y)
      day++
    }
  }

  return Buffer.from(await canvas.encode('png'))
}

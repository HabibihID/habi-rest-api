// Kalender Premium — canvas detail
import { createCanvas, ensureInter } from './canvas-helper.js'

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const NAMA_HARI = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
const NAMA_HARI_SHORT = ['SEN','SEL','RAB','KAM','JUM','SAB','MIN']

// Hari libur nasional Indonesia 2026 (lengkap)
const LIBUR = {
  '1-1': 'Tahun Baru Masehi',
  '1-16': "Isra Mi'raj",
  '2-17': 'Imlek 2577',
  '3-19': 'Nyepi Saka 1948',
  '3-20': 'Cuti Idul Fitri',
  '3-21': 'Idul Fitri 1447 H',
  '3-22': 'Idul Fitri 1447 H',
  '3-23': 'Cuti Idul Fitri',
  '4-3': 'Jumat Agung',
  '4-5': 'Paskah',
  '5-1': 'Hari Buruh',
  '5-14': 'Kenaikan Yesus',
  '5-27': 'Idul Adha 1447 H',
  '5-31': 'Waisak 2570 BE',
  '6-1': 'Lahir Pancasila',
  '6-16': 'Tahun Baru Islam',
  '8-17': 'Kemerdekaan RI',
  '8-25': 'Maulid Nabi',
  '12-24': 'Cuti Natal',
  '12-25': 'Hari Natal',
}

export async function kalenderPort(bulan, tahun) {
  await ensureInter()
  const b = parseInt(bulan) || (new Date().getMonth() + 1)
  const t = parseInt(tahun) || new Date().getFullYear()

  const W = 900, topH = 220
  const cellW = W / 7, cellH = 130
  const rows = 6
  const H = topH + 60 + rows * cellH + 80

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Background gradient krem
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
  bgGrad.addColorStop(0, '#FDF8EE')
  bgGrad.addColorStop(1, '#F5EBD5')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // Header gradient merah marun
  const headGrad = ctx.createLinearGradient(0, 0, W, 0)
  headGrad.addColorStop(0, '#8B1538')
  headGrad.addColorStop(0.5, '#A6192E')
  headGrad.addColorStop(1, '#7A0F20')
  ctx.fillStyle = headGrad
  ctx.fillRect(0, 0, W, topH)

  // Dekorasi header - lingkaran emas
  ctx.strokeStyle = 'rgba(183,134,44,0.3)'
  ctx.lineWidth = 2
  for (const [cx, cy, r] of [[80, 60, 40], [W-80, 160, 55], [W-150, 40, 25]]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  }

  // Judul bulan
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.font = '800 56px Inter, sans-serif'
  ctx.fillText(`${NAMA_BULAN[b-1]}`, W/2, 95)
  ctx.font = '400 36px Inter, sans-serif'
  ctx.fillStyle = '#EFDFB8'
  ctx.fillText(String(t), W/2, 145)

  // Garis emas
  ctx.strokeStyle = '#B7862C'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(W/2 - 100, 170); ctx.lineTo(W/2 + 100, 170); ctx.stroke()

  // Nama hari
  const hariY = topH + 35
  ctx.font = '700 22px Inter, sans-serif'
  NAMA_HARI_SHORT.forEach((h, i) => {
    ctx.fillStyle = i === 6 ? '#B5473E' : '#5A4A3A'
    ctx.fillText(h, cellW * i + cellW/2, hariY)
  })

  // Garis pemisah
  ctx.strokeStyle = '#E7DCC6'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(20, hariY + 15); ctx.lineTo(W-20, hariY + 15); ctx.stroke()

  // Tanggal
  const firstDay = new Date(t, b-1, 1).getDay()
  const daysInMonth = new Date(t, b, 0).getDate()
  const startOffset = (firstDay + 6) % 7
  const today = new Date()
  const isThisMonth = today.getMonth() + 1 === b && today.getFullYear() === t
  const todayDate = today.getDate()

  let day = 1
  const gridTop = hariY + 30
  for (let row = 0; row < rows && day <= daysInMonth; row++) {
    for (let col = 0; col < 7 && day <= daysInMonth; col++) {
      if (row === 0 && col < startOffset) continue
      const cx = cellW * col + cellW/2
      const cy = gridTop + row * cellH + cellH/2 - 10
      const isSunday = col === 6
      const holiday = LIBUR[`${b}-${day}`]
      const isToday = isThisMonth && day === todayDate

      // Highlight hari ini
      if (isToday) {
        ctx.fillStyle = '#A6192E'
        ctx.beginPath(); ctx.arc(cx, cy - 8, 32, 0, Math.PI * 2); ctx.fill()
      }

      // Nomor tanggal
      ctx.font = '700 32px Inter, sans-serif'
      if (isToday) ctx.fillStyle = '#FFFFFF'
      else if (isSunday || holiday) ctx.fillStyle = '#B5473E'
      else ctx.fillStyle = '#221A17'
      ctx.fillText(String(day), cx, cy)

      // Nama libur di bawah tanggal
      if (holiday) {
        ctx.font = '400 13px Inter, sans-serif'
        ctx.fillStyle = '#B5473E'
        // Potong jika terlalu panjang
        let label = holiday
        if (ctx.measureText(label).width > cellW - 10) {
          while (ctx.measureText(label + '…').width > cellW - 10 && label.length > 5) {
            label = label.slice(0, -1)
          }
          label += '…'
        }
        ctx.fillText(label, cx, cy + 28)
      }

      day++
    }
  }

  // Footer
  const footerY = H - 40
  ctx.font = '400 18px Inter, sans-serif'
  ctx.fillStyle = '#8A8078'
  ctx.fillText('© Habibih Cloud ID', W/2, footerY)

  return Buffer.from(await canvas.encode('png'))
}

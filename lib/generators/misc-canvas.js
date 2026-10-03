// Kalender, Fake FF/ML, Meme varian
import { svgToPng, esc } from './svg-helper.js'

export async function kalenderGen(bulan = null, tahun = null) {
  const now = new Date()
  const m = bulan ? parseInt(bulan) - 1 : now.getMonth()
  const y = tahun ? parseInt(tahun) : now.getFullYear()
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const W = 400, cellW = W / 7, cellH = 40
  const H = 80 + 40 + Math.ceil((firstDay + daysInMonth) / 7) * cellH + 20

  let cells = ''
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
  dayNames.forEach((d, i) => {
    cells += `<text x="${i * cellW + cellW/2}" y="110" font-family="sans-serif" font-size="14" font-weight="bold" fill="#666" text-anchor="middle">${d}</text>`
  })

  let day = 1
  for (let row = 0; row < 6 && day <= daysInMonth; row++) {
    for (let col = 0; col < 7 && day <= daysInMonth; col++) {
      if (row === 0 && col < firstDay) continue
      const x = col * cellW + cellW/2
      const yPos = 140 + row * cellH
      const isWeekend = col === 0
      cells += `<text x="${x}" y="${yPos}" font-family="sans-serif" font-size="16" fill="${isWeekend ? '#e74c3c' : '#333'}" text-anchor="middle">${day}</text>`
      day++
    }
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#fff"/>
  <rect width="${W}" height="70" fill="#3498db"/>
  <text x="${W/2}" y="45" font-family="sans-serif" font-size="22" font-weight="bold" fill="#fff" text-anchor="middle">${monthNames[m]} ${y}</text>
  ${cells}
</svg>`
  return svgToPng(svg, 800)
}

export async function fakeFfGen(nick, level = '50') {
  const W = 400, H = 250
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff6b35"/><stop offset="1" stop-color="#f7931e"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="20" y="40" font-family="sans-serif" font-size="16" font-weight="bold" fill="#fff">FREE FIRE</text>
  <text x="${W/2}" y="120" font-family="sans-serif" font-size="32" font-weight="bold" fill="#fff" text-anchor="middle">${esc(nick)}</text>
  <text x="${W/2}" y="160" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">Level ${esc(level)}</text>
  <text x="${W/2}" y="200" font-family="sans-serif" font-size="14" fill="#fff" opacity="0.8" text-anchor="middle">⭐ Grandmaster</text>
</svg>`
  return svgToPng(svg, 800)
}

export async function fakeMlGen(nick, rank = 'Mythic') {
  const W = 400, H = 250
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1a237e"/><stop offset="1" stop-color="#4a148c"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <text x="20" y="40" font-family="sans-serif" font-size="16" font-weight="bold" fill="#fff">MOBILE LEGENDS</text>
  <text x="${W/2}" y="120" font-family="sans-serif" font-size="32" font-weight="bold" fill="#fff" text-anchor="middle">${esc(nick)}</text>
  <text x="${W/2}" y="165" font-family="sans-serif" font-size="18" fill="#ffd700" text-anchor="middle">🏆 ${esc(rank)}</text>
</svg>`
  return svgToPng(svg, 800)
}

// Fake Chat iOS — SVG generator
import { svgToPng, esc, wrapText } from './svg-helper.js'

export async function fakeChatGen(nama, pesan, jam = null) {
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const timeStr = jam || `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  const lines = wrapText(pesan, 35)
  const lineH = 24
  const bubblePad = 30
  const bubbleH = lines.length * lineH + bubblePad
  const W = 400
  const H = 180 + bubbleH

  const textEls = lines.map((l, i) =>
    `<text x="30" y="${140 + i * lineH}" font-family="sans-serif" font-size="16" fill="#000">${esc(l)}</text>`
  ).join('')

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#E5DDD5"/>
  <!-- Header -->
  <rect width="${W}" height="60" fill="#075E54"/>
  <text x="20" y="38" font-family="sans-serif" font-size="18" font-weight="bold" fill="#fff">${esc(nama)}</text>
  <text x="${W - 70}" y="38" font-family="sans-serif" font-size="14" fill="#fff">${timeStr}</text>
  <!-- Bubble -->
  <rect x="15" y="80" width="${W - 80}" height="${bubbleH}" rx="12" fill="#fff"/>
  ${textEls}
  <text x="${W - 45}" y="${80 + bubbleH - 10}" font-family="sans-serif" font-size="11" fill="#888">${timeStr} ✓✓</text>
  <!-- Input bar -->
  <rect y="${H - 50}" width="${W}" height="50" fill="#F0F0F0"/>
  <rect x="15" y="${H - 40}" width="${W - 80}" height="30" rx="15" fill="#fff"/>
  <text x="30" y="${H - 20}" font-family="sans-serif" font-size="14" fill="#999">Ketik pesan</text>
</svg>`

  return svgToPng(svg, 800)
}

export async function fakeCallGen(nama, durasi = '00:00') {
  const W = 400, H = 700
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#1a1a2e"/>
  <text x="${W/2}" y="120" font-family="sans-serif" font-size="14" fill="#888" text-anchor="middle">WhatsApp Audio</text>
  <circle cx="${W/2}" cy="220" r="60" fill="#555"/>
  <text x="${W/2}" y="235" font-family="sans-serif" font-size="40" fill="#fff" text-anchor="middle">${esc(nama.charAt(0).toUpperCase())}</text>
  <text x="${W/2}" y="320" font-family="sans-serif" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">${esc(nama)}</text>
  <text x="${W/2}" y="350" font-family="sans-serif" font-size="16" fill="#888" text-anchor="middle">${esc(durasi)}</text>
  <!-- Buttons -->
  <g transform="translate(${W/2 - 90}, 550)">
    <circle cx="0" cy="0" r="35" fill="#333"/>
    <text x="0" y="8" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle">🔊</text>
    <circle cx="90" cy="0" r="35" fill="#ff3b30"/>
    <text x="90" y="8" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle">📞</text>
    <circle cx="180" cy="0" r="35" fill="#333"/>
    <text x="180" y="8" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle">🎤</text>
  </g>
</svg>`
  return svgToPng(svg, 800)
}

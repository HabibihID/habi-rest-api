// fakeLobbyFf — gambar lobby Free Fire PALSU (SVG → PNG).
// Ditulis dari nol untuk HABI REST API (bukan port bot orang).
//
// fakeLobbyFf(username, lobby=1)
//   username: nama player (wajib)
//   lobby   : 1-8, tiap lobby punya gradient + rank badge berbeda

import { svgToPng, esc } from './svg-helper.js'

const LOBBIES = [
  { rank: 'Bronze',      c1: '#7a4a1f', c2: '#3a2410', accent: '#cd7f32', medal: '●' },
  { rank: 'Silver',      c1: '#5a6b7d', c2: '#232c36', accent: '#c0c0c0', medal: '●' },
  { rank: 'Gold',        c1: '#8a6a1c', c2: '#3a2c08', accent: '#ffd700', medal: '★' },
  { rank: 'Platinum',    c1: '#2f7a7d', c2: '#103234', accent: '#7ff0f4', medal: '◆' },
  { rank: 'Diamond',     c1: '#3d5a99', c2: '#131d38', accent: '#5fc7ff', medal: '♦' },
  { rank: 'Heroic',      c1: '#7a1f3d', c2: '#33101c', accent: '#ff4d7d', medal: '★' },
  { rank: 'Grandmaster', c1: '#5a2d99', c2: '#1c1038', accent: '#b47fff', medal: '♛' },
  { rank: 'Elite',       c1: '#1f7a4a', c2: '#0f3320', accent: '#4dff9d', medal: '★' },
]

export async function fakeLobbyFf(username, lobby = 1) {
  const name = String(username || '').trim().slice(0, 24)
  if (!name) throw new Error('Username wajib diisi.')

  let n = parseInt(lobby, 10)
  if (!Number.isFinite(n) || n < 1 || n > 8) n = 1
  const L = LOBBIES[n - 1]

  const W = 800, H = 450
  // Potong nama jadi beberapa baris kalau terlalu panjang
  const nameSize = name.length > 14 ? 44 : 58

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${L.c1}"/><stop offset="1" stop-color="${L.c2}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${L.accent}"/><stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- dekorasi lingkaran -->
  <circle cx="700" cy="60" r="150" fill="none" stroke="${L.accent}" stroke-width="2" opacity="0.25"/>
  <circle cx="700" cy="60" r="110" fill="none" stroke="${L.accent}" stroke-width="1" opacity="0.2"/>
  <circle cx="90" cy="390" r="130" fill="none" stroke="${L.accent}" stroke-width="2" opacity="0.2"/>
  <circle cx="90" cy="390" r="90" fill="none" stroke="${L.accent}" stroke-width="1" opacity="0.15"/>
  <!-- garis dekoratif -->
  <line x1="0" y1="100" x2="${W}" y2="100" stroke="${L.accent}" stroke-width="1" opacity="0.3"/>
  <line x1="0" y1="380" x2="${W}" y2="380" stroke="${L.accent}" stroke-width="1" opacity="0.3"/>
  <!-- header FREE FIRE -->
  <text x="${W / 2}" y="64" font-family="sans-serif" font-size="34" font-weight="bold"
        fill="url(#gold)" text-anchor="middle" letter-spacing="6">FREE FIRE</text>
  <rect x="300" y="78" width="200" height="3" fill="${L.accent}" opacity="0.7"/>
  <!-- LOBBY #N -->
  <text x="${W / 2}" y="140" font-family="sans-serif" font-size="22" font-weight="bold"
        fill="#ffffff" text-anchor="middle" letter-spacing="4" opacity="0.9">LOBBY #${n}</text>
  <!-- avatar lingkaran dekoratif -->
  <circle cx="${W / 2}" cy="225" r="62" fill="none" stroke="${L.accent}" stroke-width="4"/>
  <circle cx="${W / 2}" cy="225" r="52" fill="#000000" opacity="0.35"/>
  <text x="${W / 2}" y="245" font-family="sans-serif" font-size="52" text-anchor="middle">${L.medal}</text>
  <!-- nama player besar -->
  <text x="${W / 2}" y="335" font-family="sans-serif" font-size="${nameSize}" font-weight="bold"
        fill="#ffffff" text-anchor="middle">${esc(name)}</text>
  <!-- rank badge -->
  <rect x="${W / 2 - 130}" y="352" width="260" height="34" rx="17" fill="${L.accent}" opacity="0.9"/>
  <text x="${W / 2}" y="376" font-family="sans-serif" font-size="20" font-weight="bold"
        fill="#0a0a0a" text-anchor="middle">${esc(L.rank).toUpperCase()} RANK</text>
  <!-- watermark -->
  <text x="${W / 2}" y="${H - 16}" font-family="sans-serif" font-size="13"
        fill="#ffffff" text-anchor="middle" opacity="0.45">© Habibih Cloud ID</text>
</svg>`
  return svgToPng(svg, W)
}

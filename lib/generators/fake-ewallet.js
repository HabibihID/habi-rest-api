// Fake DANA / OVO — bukti transfer palsu
import { svgToPng, esc } from './svg-helper.js'

export async function fakeDanaGen(nama, nominal, tanggal = null) {
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const tgl = tanggal || now.toISOString().slice(0, 10)
  const W = 400, H = 600

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f5f5f5"/>
  <!-- Header DANA -->
  <rect width="${W}" height="80" fill="#108EE9"/>
  <text x="20" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#fff">DANA</text>
  <!-- Success -->
  <circle cx="${W/2}" cy="150" r="40" fill="#52c41a"/>
  <text x="${W/2}" y="165" font-family="sans-serif" font-size="30" fill="#fff" text-anchor="middle">✓</text>
  <text x="${W/2}" y="220" font-family="sans-serif" font-size="18" font-weight="bold" fill="#333" text-anchor="middle">Transfer Berhasil</text>
  <text x="${W/2}" y="260" font-family="sans-serif" font-size="28" font-weight="bold" fill="#333" text-anchor="middle">Rp ${esc(nominal)}</text>
  <!-- Detail -->
  <rect x="20" y="300" width="${W-40}" height="200" rx="10" fill="#fff"/>
  <text x="40" y="340" font-family="sans-serif" font-size="14" fill="#888">Penerima</text>
  <text x="40" y="365" font-family="sans-serif" font-size="16" font-weight="bold" fill="#333">${esc(nama)}</text>
  <text x="40" y="400" font-family="sans-serif" font-size="14" fill="#888">Tanggal</text>
  <text x="40" y="425" font-family="sans-serif" font-size="16" fill="#333">${esc(tgl)}</text>
  <text x="40" y="460" font-family="sans-serif" font-size="14" fill="#888">Metode</text>
  <text x="40" y="485" font-family="sans-serif" font-size="16" fill="#333">DANA</text>
</svg>`
  return svgToPng(svg, 800)
}

export async function fakeOvoGen(nama, nominal, tanggal = null) {
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const tgl = tanggal || now.toISOString().slice(0, 10)
  const W = 400, H = 600

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f5f5f5"/>
  <rect width="${W}" height="80" fill="#4C1D95"/>
  <text x="20" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#fff">OVO</text>
  <circle cx="${W/2}" cy="150" r="40" fill="#52c41a"/>
  <text x="${W/2}" y="165" font-family="sans-serif" font-size="30" fill="#fff" text-anchor="middle">✓</text>
  <text x="${W/2}" y="220" font-family="sans-serif" font-size="18" font-weight="bold" fill="#333" text-anchor="middle">Transfer Berhasil</text>
  <text x="${W/2}" y="260" font-family="sans-serif" font-size="28" font-weight="bold" fill="#333" text-anchor="middle">Rp ${esc(nominal)}</text>
  <rect x="20" y="300" width="${W-40}" height="200" rx="10" fill="#fff"/>
  <text x="40" y="340" font-family="sans-serif" font-size="14" fill="#888">Penerima</text>
  <text x="40" y="365" font-family="sans-serif" font-size="16" font-weight="bold" fill="#333">${esc(nama)}</text>
  <text x="40" y="400" font-family="sans-serif" font-size="14" fill="#888">Tanggal</text>
  <text x="40" y="425" font-family="sans-serif" font-size="16" fill="#333">${esc(tgl)}</text>
</svg>`
  return svgToPng(svg, 800)
}

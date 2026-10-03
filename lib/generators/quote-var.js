// Quote variants — QCWA, TTQC, IGQC, QCANIME
import { svgToPng, esc, wrapText } from './svg-helper.js'

function baseQuote(text, author, style) {
  const lines = wrapText(text, 30)
  const W = 500
  const H = 120 + lines.length * 28 + 80
  const colors = {
    wa: { bg: '#0b141a', bubble: '#005c4b', text: '#e9edef' },
    tt: { bg: '#000000', bubble: '#161823', text: '#ffffff' },
    ig: { bg: '#ffffff', bubble: '#f5f5f5', text: '#000000' },
    anime: { bg: '#1a1a2e', bubble: '#16213e', text: '#eee' }
  }
  const c = colors[style] || colors.wa

  const textEls = lines.map((l, i) =>
    `<text x="40" y="${100 + i * 28}" font-family="sans-serif" font-size="18" fill="${c.text}">${esc(l)}</text>`
  ).join('')

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${c.bg}"/>
  <rect x="20" y="20" width="${W-40}" height="${H-40}" rx="15" fill="${c.bubble}"/>
  ${textEls}
  <text x="40" y="${H - 40}" font-family="sans-serif" font-size="14" font-style="italic" fill="${c.text}" opacity="0.7">— ${esc(author)}</text>
</svg>`
}

export async function qcwaGen(text, author = 'Anonymous') {
  return svgToPng(baseQuote(text, author, 'wa'), 800)
}
export async function ttqcGen(text, author = 'Anonymous') {
  return svgToPng(baseQuote(text, author, 'tt'), 800)
}
export async function igqcGen(text, author = 'Anonymous') {
  return svgToPng(baseQuote(text, author, 'ig'), 800)
}
export async function qcanimeGen(text, author = 'Anonymous') {
  return svgToPng(baseQuote(text, author, 'anime'), 800)
}

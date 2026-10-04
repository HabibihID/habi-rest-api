// /api/carbon — Kode jadi gambar cantik
import { createCanvas } from 'canvas'

const COLORS = {
  keyword: '#ff7edb', string: '#a8e6a3', number: '#f5c518',
  comment: '#6a737d', plain: '#e6e6e6', bg: '#1e1e2e',
}

function highlight(line) {
  // Sederhana: keyword, string, comment, number
  return line
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(\/\/.*$)/, '<c>$1</c>')
    .replace(/(&quot;.*?&quot;|".*?"|'.*?')/g, '<s>$1</s>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|new|class)\b/g, '<k>$1</k>')
    .replace(/\b(\d+)\b/g, '<n>$1</n>')
}

export async function carbon(code, lang = 'js') {
  if (!code) throw new Error('Kode wajib diisi')
  if (code.length > 2000) throw new Error('Maksimal 2000 karakter')
  const lines = code.split('\n').slice(0, 30)
  const fontSize = 18
  const lineHeight = 28
  const pad = 30
  const w = 800
  const h = lines.length * lineHeight + pad * 2 + 40

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#667eea')
  grad.addColorStop(1, '#764ba2')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Window
  const wx = 20, wy = 20, ww = w - 40, wh = h - 40
  ctx.fillStyle = COLORS.bg
  ctx.beginPath()
  ctx.roundRect(wx, wy, ww, wh, 12)
  ctx.fill()

  // Traffic lights
  const dots = ['#ff5f57', '#febc2e', '#28c840']
  dots.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(wx + 25 + i * 22, wy + 25, 7, 0, Math.PI * 2)
    ctx.fill()
  })

  // Code
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`
  lines.forEach((line, i) => {
    const y = wy + 60 + i * lineHeight
    // Render sederhana per kata dengan warna
    let x = wx + pad
    const tokens = line.split(/(\s+)/)
    tokens.forEach(tok => {
      let color = COLORS.plain
      if (/^(const|let|var|function|return|if|else|for|while|import|export|from|async|await|new|class)$/.test(tok)) color = COLORS.keyword
      else if (/^["'].*["']$/.test(tok)) color = COLORS.string
      else if (/^\d+$/.test(tok)) color = COLORS.number
      else if (tok.startsWith('//')) color = COLORS.comment
      ctx.fillStyle = color
      ctx.fillText(tok, x, y)
      x += ctx.measureText(tok).width
    })
  })

  return canvas.toBuffer('image/png')
}

// SVG → PNG helper via ffmpeg
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)

// Path ke asset lokal (tidak tergantung pihak ketiga)
const __dirname = dirname(fileURLToPath(import.meta.url))
export function localAsset(filename) {
  return join(__dirname, '..', '..', 'assets', 'canvas', filename)
}

export async function svgToPng(svg, width = 800) {
  const id = randomBytes(8).toString('hex')
  const svgPath = join(tmpdir(), `svg-${id}.svg`)
  const pngPath = join(tmpdir(), `svg-${id}.png`)
  try {
    await writeFile(svgPath, svg)
    await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-i', svgPath, '-vf', `scale=${width}:-1`, pngPath])
    const { readFile } = await import('fs/promises')
    const buf = await readFile(pngPath)
    return buf
  } finally {
    await unlink(svgPath).catch(() => {})
    await unlink(pngPath).catch(() => {})
  }
}

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Word wrap untuk SVG text
export function wrapText(text, maxChars) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim())
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line.trim())
  return lines
}

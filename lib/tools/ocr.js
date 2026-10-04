// /api/ocr — OCR baca teks dari gambar via URL
import { createWorker } from 'tesseract.js'

let workerPromise = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng+ind')
  }
  return workerPromise
}

export async function ocrFromBuffer(buf) {
  if (!buf || buf.length < 100) throw new Error('Gambar tidak valid')
  const worker = await getWorker()
  const { data: { text } } = await worker.recognize(buf)
  return text.trim()
}

export async function ocrFromUrl(imageUrl) {
  if (!imageUrl) throw new Error('URL gambar wajib diisi')
  const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error('Gagal download gambar')
  const buf = Buffer.from(await res.arrayBuffer())
  return ocrFromBuffer(buf)
}

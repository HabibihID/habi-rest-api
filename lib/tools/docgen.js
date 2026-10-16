// topdf & barcode — 100% milik sendiri (pdfkit + bwip-js).

import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'

// Image buffer -> PDF buffer (1 halaman, gambar fit)
export async function imageToPdf(imageBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // deteksi dimensi gambar via pdfkit (pakai image bawaan)
    const img = doc.openImage(imageBuffer)
    const pageW = 595.28, pageH = 841.89 // A4
    const margin = 36
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    const scale = Math.min(maxW / img.width, maxH / img.height)
    const w = img.width * scale
    const h = img.height * scale

    doc.addPage({ size: 'A4' })
    doc.image(imageBuffer, (pageW - w) / 2, (pageH - h) / 2, { width: w, height: h })
    doc.end()
  })
}

// Teks -> barcode PNG buffer (code128 default)
export async function textToBarcode(text, format = 'code128') {
  const formats = {
    code128: 'code128', code39: 'code39', qrcode: 'qrcode',
    datamatrix: 'datamatrix', pdf417: 'pdf417', ean13: 'ean13',
  }
  const bcid = formats[format.toLowerCase()] || 'code128'
  return bwipjs.toBuffer({
    bcid,
    text: String(text),
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  })
}

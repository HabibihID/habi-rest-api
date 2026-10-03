// IQC - iPhone Quote Card (pakai iqc-canvas via CJS)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { generateIQC } = require('iqc-canvas')

export async function iqcGen(text, time = null) {
  // Format jam: HH.MM (WIB)
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const jam = time || `${hh}.${mm}`

  const result = await generateIQC(text, jam, {
    baterai: [true, '100'],
    operator: true,
    timebar: true,
    wifi: true
  })
  if (!result?.success) throw new Error(result?.message || 'IQC gagal')
  return Buffer.from(result.image)
}

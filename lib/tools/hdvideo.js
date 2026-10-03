// hdvideo — Enhance/upscale video pakai ffmpeg (100% milik sendiri).
// Ditulis dari nol untuk HABI REST API.
//
// enhanceVideo(inputPath, outputPath):
//   - scale 2x (maks 720p sisi tinggi) pakai lanczos
//   - denoise ringan hqdn3d
//   - sharpen unsharp
//   - encode libx264 preset veryfast, CRF 23, audio AAC
// Timeout 120 detik. Input dibatasi 60 detik durasi (dicek via ffprobe).

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50 MB
export const MAX_VIDEO_DURATION = 60 // detik

async function getDuration(inputPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ], { timeout: 15000 })
  const d = parseFloat(String(stdout).trim())
  if (!isFinite(d) || d <= 0) throw new Error('Tidak bisa membaca durasi video.')
  return d
}

/**
 * Enhance video. Resolve dengan { duration } kalau sukses.
 * Throw Error kalau gagal / timeout / durasi kepanjangan.
 */
export async function enhanceVideo(inputPath, outputPath) {
  const duration = await getDuration(inputPath)
  if (duration > MAX_VIDEO_DURATION) {
    throw new Error(`Durasi video ${Math.round(duration)} detik, maksimal ${MAX_VIDEO_DURATION} detik.`)
  }

  // scale 2x (maks 720p), denoise ringan, sharpen
  const vf = "scale=-2:'min(720,ih*2)':flags=lanczos,hqdn3d=1.5:1.5:6:6,unsharp=5:5:0.8:5:5:0.4"

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-t', String(MAX_VIDEO_DURATION),
      outputPath,
    ], { timeout: 120000, maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    if (e?.killed || /timed out|ETIMEDOUT/i.test(e?.message || '')) {
      throw new Error('Proses enhance timeout (>120 detik). Coba video yang lebih pendek.')
    }
    throw new Error('ffmpeg gagal: ' + (e?.message || e))
  }

  return { duration }
}

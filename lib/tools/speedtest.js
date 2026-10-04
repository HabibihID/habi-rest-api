// /api/speedtest — Test kecepatan internet VPS
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function speedtest() {
  try {
    // Pakai speedtest-cli kalau ada, fallback ke curl
    const { stdout } = await execAsync('which speedtest || which speedtest-cli || echo ""', { timeout: 5000 })
    if (stdout.trim()) {
      const { stdout: out } = await execAsync(`${stdout.trim()} --simple`, { timeout: 60000 })
      const ping = out.match(/Ping:\s*([\d.]+)/)?.[1]
      const down = out.match(/Download:\s*([\d.]+)/)?.[1]
      const up = out.match(/Upload:\s*([\d.]+)/)?.[1]
      return { ping: ping + ' ms', download: down + ' Mbit/s', upload: up + ' Mbit/s', method: 'speedtest-cli' }
    }
  } catch {}

  // Fallback: download test file 10MB dari Cloudflare
  const start = Date.now()
  const res = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', {
    signal: AbortSignal.timeout(30000),
  })
  const buf = await res.arrayBuffer()
  const secs = (Date.now() - start) / 1000
  const mbps = ((buf.byteLength * 8) / secs / 1e6).toFixed(2)
  return { download: mbps + ' Mbit/s', method: 'cloudflare-download', note: 'Upload/ping tidak diukur' }
}

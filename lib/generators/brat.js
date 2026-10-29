// Brat text -> image: mesin Impact baru (child process, mode image) —
// font sama persis dengan bratvid baru + emoji asli + tema. Fallback brat-canvas.
export async function bratGen(text, opts = {}) {
  try {
    return await runBratChild({
      mode: 'image',
      text,
      theme: ['black', 'white', 'green'].includes(opts.theme) ? opts.theme : 'white',
      blur: [0, 1, 2, 3].includes(opts.blur) ? opts.blur : 0,
      format: 'mp4',
      hold: 0,
    })
  } catch (e) {
    const { bratGen } = await import('brat-canvas')
    const buf = await bratGen(text, { BLUR: 0 })
    return Buffer.from(buf)
  }
}

// Brat video -> mesin BARU (kode sendiri) dijalankan di CHILD PROCESS
// (lib/generators/bratvid-runner.mjs) supaya crash native canvas tidak
// menjatuhkan API. Tema black|white|green, blur 0-3, format mp4|gif, 60fps.
// Fallback ke brat-canvas lama khusus mp4 bila render anak gagal.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), 'bratvid-runner.mjs')
let bratQueue = Promise.resolve()

function runBratChild(opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER, JSON.stringify(opts)], { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks = []
    let err = ''
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Render bratvid timeout (120 dtk)')) }, 120000)
    child.stdout.on('data', d => chunks.push(d))
    child.stderr.on('data', d => { err += d })
    child.on('error', e => { clearTimeout(timer); reject(e) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(chunks))
      else reject(new Error(`Render bratvid gagal (exit ${code}): ${err.slice(-200)}`))
    })
  })
}

export async function bratVidGen(text, opts = {}) {
  const format = opts.format === 'gif' ? 'gif' : 'mp4'
  const run = bratQueue.then(async () => {
    try {
      return await runBratChild({
        text,
        theme: ['black', 'white', 'green'].includes(opts.theme) ? opts.theme : 'white',
        blur: [0, 1, 2, 3].includes(opts.blur) ? opts.blur : 0,
        format,
        hold: Number.isFinite(opts.hold) ? opts.hold : 1.5,
      })
    } catch (e) {
      if (format === 'gif') throw e
      const { bratVid } = await import('brat-canvas/video')
      const buf = await bratVid(text, { outputFormat: 'mp4' })
      return Buffer.from(buf)
    }
  })
  bratQueue = run.catch(() => {})
  return run
}

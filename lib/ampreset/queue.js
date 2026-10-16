// Queue sederhana: batasi concurrent request ke provider komentar
// agar tidak kena rate limit.
const MAX_CONCURRENT = 2
let active = 0
const waiting = []

function next() {
  if (active >= MAX_CONCURRENT || !waiting.length) return
  active++
  const { fn, resolve, reject } = waiting.shift()
  fn().then(
    (v) => { active--; resolve(v); next() },
    (e) => { active--; reject(e); next() }
  )
}

export function enqueue(fn) {
  return new Promise((resolve, reject) => {
    waiting.push({ fn, resolve, reject })
    next()
  })
}

export function stats() { return { active, waiting: waiting.length } }

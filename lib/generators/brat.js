// Brat text -> image (pakai brat-canvas)
export async function bratGen(text) {
  const { bratGen } = await import('brat-canvas')
  const buf = await bratGen(text, { BLUR: 0 })
  return Buffer.from(buf)
}

export async function bratVidGen(text) {
  const { bratVid } = await import('brat-canvas/video')
  const buf = await bratVid(text, { outputFormat: 'mp4' })
  return Buffer.from(buf)
}

// wink — Port dari scrape-wink.js (Wink AI Image Enhancer).
// - info: metadata publik (tanpa login)
// - enhance: butuh WINK_COOKIE di env (sesi login Wink user)

const BASE = 'https://wink.ai'
const CLIENT_ID = '1189857605'
const UA = 'Mozilla/5.0 (Linux; Android 12; Termux) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

const MODES = {
  hd:      { functionId: 63090, functionType: 2,  materialId: '63001', variant: 'hd',     taskType: 1, extValue: '1' },
  ultrahd: { functionId: 63091, functionType: 12, materialId: '63011', variant: 'live',   taskType: 1, extValue: '2' },
  uhd:     { functionId: 63093, functionType: 55, materialId: '63031', variant: 'aiLive', taskType: 1, extValue: '4' },
}

function headers(extra = {}) {
  const h = { 'User-Agent': UA, 'Accept': 'application/json, */*', 'Origin': BASE, 'Referer': BASE + '/image-enhancer/upload', ...extra }
  const ck = process.env.WINK_COOKIE
  if (ck) {
    h['Cookie'] = ck
    const m = ck.match(/(?:^|;\s*)__mt_access_token__=([^;]+)/)
    if (m) h['Access-Token'] = decodeURIComponent(m[1])
  }
  return h
}

async function req(method, url, { data, params, contentType } = {}) {
  const full = url.startsWith('http') ? url : BASE + url
  const u = new URL(full)
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const opts = { method, headers: headers(), signal: AbortSignal.timeout(30000) }
  if (data) {
    if (contentType) opts.headers['Content-Type'] = contentType
    opts.body = data
  }
  const r = await fetch(u, opts)
  const txt = await r.text()
  try { return { status: r.status, json: JSON.parse(txt) } } catch { return { status: r.status, text: txt } }
}

function pickUrlDeep(obj, d = 0) {
  if (obj == null || d > 6) return null
  if (typeof obj === 'string') return /^https?:\/\//.test(obj) ? obj : null
  if (Array.isArray(obj)) { for (const x of obj) { const r = pickUrlDeep(x, d + 1); if (r) return r } return null }
  if (typeof obj === 'object') {
    for (const k of ['url','result_url','media_url','download_url','file_url','output_url']) {
      if (typeof obj[k] === 'string' && /^https?:\/\//.test(obj[k])) return obj[k]
    }
    for (const k of Object.keys(obj)) { const r = pickUrlDeep(obj[k], d + 1); if (r) return r }
  }
  return null
}

export function winkInfo() {
  return {
    modes: {
      hd:      { name: 'HD',       desc: 'Penajaman standar, upscale ke HD' },
      ultrahd: { name: 'Ultra HD', desc: 'Restorasi + penajaman, upscale ke 4K' },
      uhd:     { name: 'AI UHD',   desc: 'Advanced Restoration 3.0, 2-3x (butuh VIP)' },
    },
    note: 'Mode enhance butuh WINK_COOKIE (sesi login Wink) di env VPS.',
  }
}

export async function winkEnhance(imageBuffer, filename, modeKey = 'ultrahd') {
  if (!process.env.WINK_COOKIE) throw new Error('WINK_COOKIE belum diisi di .env VPS. Login ke wink.ai, copy cookie __mt_access_token__.')
  const mode = MODES[modeKey] || MODES.ultrahd

  const fd = new FormData()
  fd.append('media', new Blob([imageBuffer]), filename || 'image.jpg')
  const upR = await fetch(BASE + '/api/v1/upload', { method: 'POST', headers: headers(), body: fd, signal: AbortSignal.timeout(60000) })
  const upJ = await upR.json().catch(() => null)
  if (!upJ || upJ.code === 10111) throw new Error('Sesi Wink tidak valid / belum login (code 10111). Perbarui WINK_COOKIE.')
  const mediaUrl = pickUrlDeep(upJ)
  if (!mediaUrl) throw new Error('Upload gagal: URL media tidak ditemukan.')

  const payload = {
    taskType: mode.taskType, name: 'ImageEnhancer-' + modeKey + '-' + Date.now(),
    clientExtParams: {}, withPrepare: 0,
    subtaskList: [{
      functionId: mode.functionId, function_id: mode.functionId, type: mode.functionType,
      taskType: mode.taskType, content_type: 1, extValue: mode.extValue, materialId: mode.materialId,
      sourceFile: { url: mediaUrl, mediaType: 'image', contentType: 1 },
      url: mediaUrl, typeParams: {}, extParams: {},
    }],
  }
  const cr = await req('POST', '/api/meitu_ai_task_group/create_and_delivery.json', { data: JSON.stringify(payload), contentType: 'application/json' })
  const taskId = cr.json?.data?.msgId || cr.json?.data?.taskId || cr.json?.data?.id
  if (!taskId) throw new Error('Create task gagal: ' + JSON.stringify(cr.json).slice(0, 200))

  const deadline = Date.now() + 180000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000))
    const pr = await req('GET', '/api/meitu_ai/query_batch.json', { params: { client_id: CLIENT_ID, version: '1.0.0', msgIds: String(taskId) } })
    const url = pickUrlDeep(pr.json?.data)
    if (url) {
      const dr = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
      const buf = Buffer.from(await dr.arrayBuffer())
      return { buffer: buf, mime: dr.headers.get('content-type') || 'image/jpeg', url }
    }
  }
  throw new Error('Timeout menunggu hasil Wink (3 menit).')
}

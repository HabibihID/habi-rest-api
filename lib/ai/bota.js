// Bota — AI chat via bota.chat (mode tamu resmi situsnya) untuk HABI REST API.
// Diadaptasi dari Bota.chat wrapper kiriman user 2026-10-21 dengan SATU sesi
// tamu persisten (data/bota-session.json). Berbeda dari kode aslinya:
// rotasi identitas saat kena limit DIBUANG — token kedaluwarsa = login ulang
// biasa; limit/kredit habis = error jujur ke pemanggil, bukan ganti identitas.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://bota.chat'
const FRAME_ID = 'x8OA7Azs4hBy'
const SITE_ID = 53
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const SESSION_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../data/bota-session.json')
const LOCALE = 'id'

function headers(token = null) {
  const h = { Accept: 'application/json', 'User-Agent': UA }
  if (token) h['x-anon-token'] = token
  return h
}

async function req(method, path, { body, token } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const opts = { method, headers: headers(token), signal: AbortSignal.timeout(120000) }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('event-stream') || (url.includes('/frame/stream') && res.ok)) {
    return { ok: res.ok, status: res.status, stream: res.body }
  }
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

async function parseSSE(readableStream, onEvent) {
  const reader = readableStream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try { onEvent(JSON.parse(line.slice(6))) } catch { /* lewati event rusak */ }
    }
  }
}

/* ---------------- Sesi tamu tunggal ---------------- */

let session = null // { token, publicId }

function loadSession() {
  if (session) return session
  try {
    if (existsSync(SESSION_FILE)) {
      const s = JSON.parse(readFileSync(SESSION_FILE, 'utf8'))
      if (s.token) session = { token: s.token, publicId: s.publicId || null }
    }
  } catch { /* abaikan, login baru */ }
  return session
}

function saveSession() {
  try {
    mkdirSync(dirname(SESSION_FILE), { recursive: true })
    writeFileSync(SESSION_FILE, JSON.stringify(session || {}, null, 2))
  } catch { /* sesi tetap jalan di memori */ }
}

async function anonLogin() {
  const { ok, data, status } = await req('POST', `/__fs/f/${FRAME_ID}/anon?fs_locale=${LOCALE}`, {
    body: {
      screen: '390x844',
      timezone: 'Asia/Jakarta',
      navigator_language: 'id-ID',
      ui_locale: LOCALE,
    },
  })
  if (!ok || !data?.success) throw new Error(`Login tamu Bota gagal (${status})`)
  session = { token: data.anonymous_token, publicId: data.public_id }
  saveSession()
  return session
}

async function getMe() {
  const s = loadSession()
  if (!s?.token) return null
  const { data, status } = await req('GET', `/__fs/f/${FRAME_ID}/me?fs_locale=${LOCALE}`, { token: s.token })
  if (status === 401 || data?.success === false) return null
  return data
}

async function ensureAuth(force = false) {
  if (!force) {
    const me = await getMe().catch(() => null)
    if (me?.success) return session
  }
  return anonLogin()
}

async function createChat(token) {
  const { ok, data, status } = await req('POST', `/__fs/f/${FRAME_ID}/chat?fs_locale=${LOCALE}`, {
    token, body: { site_id: SITE_ID, agent_open: false },
  })
  if (!ok || !data?.success) {
    const err = new Error(`Buat chat Bota gagal (${status}): ${JSON.stringify(data).slice(0, 200)}`)
    err.status = status
    throw err
  }
  return data.chat.hash_id
}

function limitError(msg) {
  const e = new Error(msg || 'Limit/kredit tamu Bota habis. Coba lagi nanti.')
  e.code = 'BOTA_LIMIT'
  return e
}

/**
 * Chat satu giliran (chat baru tiap panggilan — tidak mencampur percakapan).
 * Return { text, model, credits, balance, suggestions, sources }.
 */
export async function botaChat(message, { model = 'default-model', webSearch = false } = {}) {
  if (!message?.trim()) throw new Error('Pesan wajib diisi')
  let s = await ensureAuth()

  let chatId
  try {
    chatId = await createChat(s.token)
  } catch (e) {
    if (e.status === 401) { // token mati di tengah jalan -> login ulang SEKALI
      s = await ensureAuth(true)
      chatId = await createChat(s.token)
    } else if (e.status === 402 || e.status === 429 || e.status === 403) {
      throw limitError(`Bota membatasi akses tamu (HTTP ${e.status}). Coba lagi nanti.`)
    } else throw e
  }

  const payload = {
    chat_id: chatId,
    locale: LOCALE,
    paywall_currency: 'USD',
    message,
    model,
    image_mode: false, video_mode: false, diagram_mode: false, plot_mode: false,
    web_search: !!webSearch,
    voice_mode: false,
    hidden: false,
    attachments: [],
    vision_capable: true,
    tools_capable: true,
    image_gen_capable: false,
    from_suggestion: false,
    agent_open: false,
  }

  const res = await req('POST', `/__fs/api/frame/stream?fs_locale=${LOCALE}`, { token: s.token, body: payload })
  if (!res.ok || !res.stream) {
    const errStr = JSON.stringify(res.data || {}).slice(0, 300)
    if (/credit|paywall|limit|quota|balance|402|429/i.test(errStr)) throw limitError()
    throw new Error(`Stream Bota gagal (HTTP ${res.status}): ${errStr}`)
  }

  const chunks = []
  const result = { text: '', model: null, credits: null, balance: null, suggestions: [], sources: [] }
  let streamError = null

  await parseSSE(res.stream, (ev) => {
    if (ev.error || ev.paywall || ev.limit_reached) { streamError = ev; return }
    if (ev.chunk) chunks.push(ev.chunk)
    if (ev.tool_step?.status === 'done' && ev.tool_step.sources) {
      for (const src of ev.tool_step.sources) {
        result.sources.push({ url: src.url, title: src.title })
      }
    }
    if (ev.done) {
      result.model = ev.timing?.model || null
      result.credits = ev.timing?.credits ?? null
      result.balance = ev.new_balance ?? null
      result.suggestions = ev.suggestions || []
      if (ev.sources?.length) result.sources = ev.sources.map((x) => ({ url: x.url, title: x.title }))
    }
  })

  if (streamError) {
    const msg = JSON.stringify(streamError).slice(0, 300)
    if (/credit|paywall|limit|quota|balance/i.test(msg)) throw limitError()
    throw new Error(`Bota error: ${msg}`)
  }

  result.text = chunks.join('').trim()
  if (!result.text) throw new Error('Bota tidak memberi jawaban (respons kosong)')
  return result
}

export default { botaChat }

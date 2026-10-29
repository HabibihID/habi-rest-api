// AI helpers milik HABI REST API.
//
// chatAi(prompt):   Chat via Cloudflare Workers AI (DIRECT API, tanpa proxy).
// text2img(prompt): Text-to-image via Cloudflare Workers AI (flux-1-schnell).
//
// Kredensial dari .env: CF_ACCOUNT_ID + CF_API_TOKEN.
// (Dulu lewat Worker proxy proxy.servercloud.my.id — sejak Okt 2026 proxy itu
//  kena Cloudflare challenge 403 dari IP VPS, jadi dialihkan direct seperti
//  endpoint sholat. fetch memakai node:https family:4 — VPS tanpa rute IPv6.)
//
// Ditulis dari nol untuk HABI REST API.

import https from 'node:https'

const MODEL_CHAT = '@cf/meta/llama-3.2-1b-instruct'
const MODEL_IMG = '@cf/black-forest-labs/flux-1-schnell'

function cfRun(model, payload, timeoutMs = 90000) {
  const acc = process.env.CF_ACCOUNT_ID
  const tok = process.env.CF_API_TOKEN
  if (!acc || !tok) return Promise.reject(new Error('Kredensial Cloudflare belum dipasang di server (CF_ACCOUNT_ID/CF_API_TOKEN).'))
  const body = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${acc}/ai/run/${model}`,
      method: 'POST',
      family: 4,
      timeout: timeoutMs,
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'] || '',
        body: Buffer.concat(chunks),
      }))
    })
    req.on('timeout', () => req.destroy(new Error('Timeout ke Cloudflare AI')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function parseCfJson(r) {
  let j
  try { j = JSON.parse(r.body.toString('utf8')) } catch { throw new Error(`Cloudflare AI HTTP ${r.status} (respons bukan JSON)`) }
  if (r.status !== 200 || !j.success) {
    const msg = j?.errors?.[0]?.message || `Cloudflare AI HTTP ${r.status}`
    throw new Error(msg)
  }
  return j.result
}

// Tanya jawab AI (return string)
export async function chatAi(prompt) {
  prompt = String(prompt || '').trim()
  if (!prompt) throw new Error('Prompt kosong.')
  const sysPrompt = 'Jawablah selalu dalam Bahasa Indonesia yang natural dan santai.'
  const result = await parseCfJson(await cfRun(MODEL_CHAT, {
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: prompt },
    ],
  }, 60000))
  const text = String(result?.response || '').trim()
  if (!text) throw new Error('Workers AI mengembalikan teks kosong.')
  return text
}

// Speech-to-text (Whisper) — input Buffer audio, output teks
export async function sttWhisper(audioBuf) {
  if (!Buffer.isBuffer(audioBuf) || audioBuf.length < 100) throw new Error('Audio kosong.')
  const result = await parseCfJson(await cfRun('@cf/openai/whisper', {
    audio: [...audioBuf],
  }, 90000))
  const text = String(result?.text || '').trim()
  if (!text) throw new Error('Whisper tidak menangkap teks apa pun.')
  return text
}

// Analisa sentimen — output [{label, score}]
export async function sentimentText(text) {
  const t = String(text || '').trim()
  if (!t) throw new Error('Teks kosong.')
  const result = await parseCfJson(await cfRun('@cf/huggingface/distilbert-sst-2-int8', { text: t }, 30000))
  if (!Array.isArray(result) || !result.length) throw new Error('Model sentimen tidak mengembalikan hasil.')
  return result
}

// Klasifikasi gambar (ResNet-50) — input Buffer gambar, output [{label, score}]
export async function classifyImage(imgBuf) {
  if (!Buffer.isBuffer(imgBuf) || imgBuf.length < 100) throw new Error('Gambar kosong.')
  const result = await parseCfJson(await cfRun('@cf/microsoft/resnet-50', {
    image: [...imgBuf],
  }, 60000))
  if (!Array.isArray(result) || !result.length) throw new Error('Model klasifikasi tidak mengembalikan hasil.')
  return result
}

// Translate (m2m100) — from/to nama bahasa ala Cloudflare ("english", "indonesian", ...)
export async function translateAi(text, from = 'english', to = 'indonesian') {
  const t = String(text || '').trim()
  if (!t) throw new Error('Teks kosong.')
  const result = await parseCfJson(await cfRun('@cf/meta/m2m100-1.2b', {
    text: t, source_lang: String(from || 'english'), target_lang: String(to || 'indonesian'),
  }, 30000))
  const out = String(result?.translated_text || '').trim()
  if (!out) throw new Error('Model translate tidak mengembalikan hasil.')
  return out
}

// Text-to-image (return Buffer gambar)
export async function text2img(prompt) {
  prompt = String(prompt || '').trim()
  if (!prompt) throw new Error('Prompt kosong.')
  const r = await cfRun(MODEL_IMG, { prompt }, 90000)
  if (r.status === 200 && r.contentType.startsWith('image/')) {
    if (!r.body.length) throw new Error('Workers AI mengembalikan gambar kosong.')
    return r.body
  }
  const result = await parseCfJson(r)
  const b64 = result?.image
  if (!b64) throw new Error('Workers AI tidak mengembalikan gambar.')
  const buf = Buffer.from(b64, 'base64')
  if (!buf.length) throw new Error('Workers AI mengembalikan gambar kosong.')
  return buf
}

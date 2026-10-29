// Routes fitur untuk HABI REST API — ditulis dari nol untuk HABI AI.
// Dipasang lokal saja di tugas build71; deploy ke VPS live menunggu laporan parent.
// Prinsip: hanya sumber publik/resmi tanpa key, tanpa bypass anti-bot/CAPTCHA.
// Yang belum ada provider resminya: kembalikan 501 dengan pesan jelas, jangan ditebak.
import { Router } from 'express'
import https from 'node:https'
const router = Router()
async function fetchJson(url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { const r = await fetch(url, { headers: { 'User-Agent': 'HABI-REST-API/1.0' }, signal: c.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json() } finally { clearTimeout(t) }
}
// AlQuran Cloud punya IPv6 yang tidak bisa dijangkau dari VPS Oracle (ENETUNREACH),
// sehingga fetch Node gagal padahal curl/TCP IPv4 jalan. Paksa IPv4 via https family:4.
// Ini pilihan keluarga DNS saja, bukan bypass — TLS & verifikasi sertifikat tetap jalan.
function fetchJson4(url, ms = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': 'HABI-REST-API/1.0' } }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) throw new Error(`HTTP ${res.statusCode}`)
          resolve(JSON.parse(d))
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(ms, () => req.destroy(new Error('Timeout')))
  })
}
function ok(res, data) { res.json({ status: true, data }) }
function fail(res, msg, code = 500) { res.status(code).json({ status: false, message: msg }) }

// ---- /fitur/murrotal?surah=1 — AlQuran Cloud (publik, tanpa key) ----
router.get('/murrotal', async (req, res) => {
  const n = parseInt(req.query.surah, 10)
  if (!n || n < 1 || n > 114) return fail(res, 'Nomor surah 1-114 wajib.', 400)
  try {
    const j = await fetchJson4(`https://api.alquran.cloud/v1/surah/${n}/ar.alafasy`)
    const s = j.data
    const audio = s?.ayahs?.[0]?.audio
    if (!audio) throw new Error('Audio tidak ditemukan.')
    // Audio per ayat tersedia; kirim audio ayat pertama + info surah (plugin bisa request ulang bila perlu)
    ok(res, { surah: n, name: s.englishName, arabicName: s.name, ayahs: s.numberOfAyahs, audio, audioSecondary: s.ayahs?.[0]?.audioSecondary || null })
  } catch (e) { fail(res, e.message) }
})

// ---- /fitur/stalk?type=...&q=... ----
router.get('/stalk', async (req, res) => {
  const type = String(req.query.type || '').toLowerCase()
  const q = String(req.query.q || '').trim()
  if (!q) return fail(res, 'Parameter ?q= wajib.', 400)
  try {
    if (type === 'countrystalk') {
      // Diverifikasi 2026-10-29: REST Countries v1-v4 DIMATIKAN permanen
      // (semua versi lama mengembalikan body deprecated yang sama); v5 butuh
      // akun + API key (Authorization: Bearer) — tidak ditebak, tidak dibypass.
      // Endpoint ini aktif kembali bila owner mengisi RESTCOUNTRIES_KEY di .env
      // VPS dan bentuk respons v5 dipetakan dari docs resmi.
      return fail(res, 'REST Countries v1-v4 sudah dimatikan permanen; v5 butuh akun + API key. .countrystalk belum aktif sampai owner mengisi RESTCOUNTRIES_KEY di .env VPS.', 501)
    }
    if (type === 'robloxplayer') {
      const s = await fetchJson(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(q)}&limit=10`)
      const u = s.data?.[0]; if (!u) throw new Error('User Roblox tidak ditemukan.')
      const detail = await fetchJson(`https://users.roblox.com/v1/users/${u.id}`).catch(() => ({}))
      let avatar = null
      try { const th = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${u.id}&size=150x150&format=Png`); avatar = th.data?.[0]?.imageUrl || null } catch {}
      return ok(res, { username: u.name, displayName: u.displayName, id: u.id, description: detail.description || '', created: detail.created || '', avatar })
    }
    if (type === 'genshinstalk') {
      if (!/^\d{9}$/.test(q)) throw new Error('UID Genshin harus 9 digit.')
      const j = await fetchJson(`https://enka.network/api/uid/${q}`)
      const p = j.playerInfo || {}
      return ok(res, { uid: q, nickname: p.nickname || '-', level: p.level || '-', worldLevel: p.worldLevel || '-', signature: p.signature || '', achievements: p.finishAchievementNum || '' })
    }
    if (type === 'discordstalk') {
      return fail(res, 'Discord tidak menyediakan lookup profil publik tanpa token bot. Endpoint ini sengaja tidak menebak / scraping Discord.', 501)
    }
    if (type === 'pintereststalk') {
      return fail(res, 'Pinterest tidak menyediakan API profil publik tanpa key. Endpoint ini sengaja tidak scraping Pinterest.', 501)
    }
    return fail(res, 'Tipe stalk tidak dikenal.', 400)
  } catch (e) { fail(res, e.message) }
})

// ---- /fitur/search?type=...&q=... ----
router.get('/search', async (req, res) => {
  const type = String(req.query.type || '').toLowerCase()
  const q = String(req.query.q || '').trim()
  if (!q) return fail(res, 'Parameter ?q= wajib.', 400)
  try {
    if (type === 'animeapaini') {
      // trace.moe: API publik terdokumentasi, menerima URL gambar
      const j = await fetchJson(`https://api.trace.moe/search?url=${encodeURIComponent(q)}`)
      const r = j.result?.[0]
      if (!r) throw new Error('Anime tidak teridentifikasi dari URL itu.')
      return ok(res, { text: `Anime: ${r.filename || '-'} | Episode: ${r.episode || '-'} | Kemiripan: ${(r.similarity * 100).toFixed(1)}% | Waktu: ${r.from}s - ${r.to}s`, results: [{ title: r.filename, url: r.video || '' }] })
    }
    if (type === 'pddikti') {
      return fail(res, 'PDDikti tidak menyediakan endpoint pencarian publik yang stabil tanpa key di tugas ini. Tidak ditebak.', 501)
    }
    // Untuk tipe search lain yang belum ada provider resmi/stabil di tugas ini:
    return fail(res, `Provider search untuk ${type} belum terkonfirmasi / belum diaktifkan di API live. Plugin akan menampilkan pesan ini, bukan hasil palsu.`, 501)
  } catch (e) { fail(res, e.message) }
})

// ---- /fitur/download?platform=...&url=... ----
router.get('/download', async (req, res) => {
  const platform = String(req.query.platform || '').toLowerCase()
  const url = String(req.query.url || '').trim()
  if (!url) return fail(res, 'Parameter ?url= wajib.', 400)
  try {
    if (platform === 'pixeldraindl') {
      const m = url.match(/pixeldrain\.com\/[ul]\/([A-Za-z0-9]+)/)
      if (!m) throw new Error('URL Pixeldrain tidak valid.')
      const info = await fetchJson(`https://pixeldrain.com/api/file/${m[1]}/info`)
      return ok(res, { title: info.name || 'File Pixeldrain', url: `https://pixeldrain.com/api/file/${m[1]}` })
    }
    if (platform === 'ttmp3') {
      // TikTok audio: arahkan ke endpoint tiktok yang sudah ada di API ini bila tersedia di plugin,
      // di sini kembalikan info bahwa konversi audio TikTok memakai /api/tiktok (bukan ditebak di route ini)
      return fail(res, 'TTMP3: gunakan endpoint /api/tiktok yang sudah ada di API HABI untuk URL TikTok, lalu ambil audio-nya. Route fitur ini tidak menduplikasi logika tiktok.', 501)
    }
    return fail(res, `Downloader ${platform} belum terkonfirmasi provider resminya / belum diaktifkan di API live. Tidak dibypass, tidak ditebak.`, 501)
  } catch (e) { fail(res, e.message) }
})

export default router

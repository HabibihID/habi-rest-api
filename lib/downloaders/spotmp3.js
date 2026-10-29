// spotmp3 — "Spotify play" via API publik spotmp3.net.
//
// Diport dari scraper scrape-spotifyplay.js karya Razeerh (CJS + axios)
// ke ESM + fetch bawaan, dan disederhanakan untuk kebutuhan bot:
// - spPlaySearch: cari track (metadata ala Spotify: judul, artis, album,
//   cover, durasi) dari endpoint search mereka.
// - spPlayAudio: siapkan MP3 untuk SATU track — server mereka bekerja
//   async (POST /jobs -> poll status -> download_url per track, berlaku
//   24 jam). Bitrate hasil biasanya 320k; penyesuaian ke 128k urusan bot.
//
// Kuota gratis mereka: 30 track per IP per hari, reset tengah malam UTC.
// Karena audio hanya disiapkan per track yang benar-benar dipilih user,
// pemakaian kuota tetap hemat. Tidak ada API key / cookie / bypass —
// murni API publik yang sama dengan yang dipakai web mereka sendiri.

const ORIGIN = 'https://spotmp3.net'
const BASE = `${ORIGIN}/api/v1`
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${ORIGIN}/`,
  Origin: ORIGIN,
  'Content-Type': 'application/json',
}

const FAILURE_MESSAGES = {
  no_match: 'Tidak ditemukan sumber audio yang cocok untuk lagu ini.',
  unavailable: 'Audio lagu ini tidak tersedia.',
  age_restricted: 'Lagu ini dibatasi usia di sumber audionya.',
  bot_block: 'Sumber audio memblokir permintaan (proteksi bot).',
  region_blocked: 'Lagu ini tidak tersedia di region server.',
  download_refused: 'Sumber audio menolak unduhan.',
  timeout: 'Penyiapan audio kehabisan waktu.',
  quota_exhausted: 'Kuota gratis harian SpotMP3 habis (30 lagu/hari), reset jam 07:00 WIB.',
  ffmpeg: 'Konversi audio di server SpotMP3 gagal.',
  missing_file: 'Job selesai tapi tidak menghasilkan file MP3.',
  network: 'Server SpotMP3 tidak bisa dihubungi.',
  rate_limited: 'SpotMP3 sedang membatasi permintaan, coba lagi sebentar.',
  server_error: 'Server SpotMP3 mengembalikan error.',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function apiFetch(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), timeoutMs)
  try {
    const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
      signal: c.signal,
    })
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  } catch (e) {
    throw new Error(`SpotMP3 tidak bisa dihubungi: ${e.name === 'AbortError' ? 'timeout' : e.message}`)
  } finally {
    clearTimeout(t)
  }
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function apiErrorMessage(status, json) {
  const code = json?.error?.code || ''
  if (/quota/i.test(code) || (status === 429 && /quota/i.test(json?.error?.message || ''))) {
    return FAILURE_MESSAGES.quota_exhausted
  }
  if (status === 429) return FAILURE_MESSAGES.rate_limited
  return json?.error?.message || json?.detail || `SpotMP3 HTTP ${status}`
}

// ---------------- Search ----------------

export async function spPlaySearch(query, limit = 8) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Query pencarian wajib diisi.')
  const lim = Math.min(Math.max(parseInt(limit) || 8, 1), 25)
  const { status, json } = await apiFetch(`/search?q=${encodeURIComponent(q)}&limit=${lim}&offset=0`)
  if (status < 200 || status >= 300) throw new Error(apiErrorMessage(status, json))
  const sections = Array.isArray(json?.sections) ? json.sections : []
  const trackSection = sections.find((s) => s?.type === 'track') || {}
  const items = Array.isArray(trackSection.items) ? trackSection.items : []
  const tracks = items
    .filter((it) => it && it.type === 'track' && it.id)
    .map((it) => ({
      id: it.id,
      url: it.url || `https://open.spotify.com/track/${it.id}`,
      title: it.title || 'Unknown',
      artist: it.subtitle || null,
      artists: it.subtitle ? it.subtitle.split(/\s*,\s*/).filter(Boolean) : [],
      album: it.album ?? null,
      duration_ms: Number.isFinite(it.duration_ms) ? it.duration_ms : null,
      duration: fmtDuration(it.duration_ms),
      cover: it.cover ?? null,
    }))
  return { provider: 'spotmp3', query: q, total: trackSection.total ?? tracks.length, tracks }
}

// ---------------- Audio (job async, 1 track) ----------------

function trackIdFromUrl(url) {
  const m = String(url || '').match(/track\/([A-Za-z0-9]{22})/)
  return m ? m[1] : null
}

export async function spPlayAudio(spotifyUrl) {
  const trackId = trackIdFromUrl(spotifyUrl)
  if (!trackId) throw new Error('URL Spotify tidak valid — harus link track (open.spotify.com/track/...).')
  const canonical = `https://open.spotify.com/track/${trackId}`

  // 1. Buat job (1 track saja — hemat kuota harian)
  const created = await apiFetch('/jobs', {
    method: 'POST',
    body: { track_urls: [canonical], title: 'HABI spplay', lyrics: false },
  })
  if (created.status < 200 || created.status >= 300 || !created.json?.job_id) {
    throw new Error(apiErrorMessage(created.status, created.json))
  }
  const jobId = created.json.job_id
  let quotaRemaining = created.json.quota_remaining ?? null

  // 2. Poll sampai terminal (maks ±4 menit; cache biasanya <10 detik)
  const deadline = Date.now() + 240000
  let job = null
  while (Date.now() < deadline) {
    await sleep(4000)
    const polled = await apiFetch(`/jobs/${jobId}`, { timeoutMs: 20000 }).catch(() => null)
    if (!polled || polled.status < 200 || polled.status >= 300) continue // gangguan sesaat — poll lagi
    job = polled.json
    if (job?.quota_remaining != null) quotaRemaining = job.quota_remaining
    if (['completed', 'partial', 'failed', 'cancelled'].includes(job?.status)) break
    job = null
  }
  if (!job) {
    await apiFetch(`/jobs/${jobId}`, { method: 'DELETE' }).catch(() => {})
    throw new Error('Penyiapan audio terlalu lama (>4 menit) — job dibatalkan, coba lagi.')
  }

  // 3. Ambil track hasil job
  const track = (job.tracks || []).find((t) => t?.id === trackId) || job.tracks?.[0]
  if (!track?.download_url) {
    const fc = track?.failure_class || ''
    throw new Error(FAILURE_MESSAGES[fc] || track?.error || FAILURE_MESSAGES.server_error)
  }
  const bitrateKbps = parseInt(String(job.bitrate || '').match(/(\d{2,4})/)?.[1]) || null
  return {
    provider: 'spotmp3',
    id: trackId,
    url: canonical,
    title: track.title || 'Unknown',
    artist: Array.isArray(track.artists) && track.artists.length ? track.artists.join(', ') : null,
    artists: track.artists || [],
    album: track.album ?? null,
    cover: track.cover ?? job.cover ?? null,
    duration_ms: track.duration_ms ?? null,
    duration: fmtDuration(track.duration_ms),
    format: job.format || 'mp3',
    bitrate_kbps: bitrateKbps,
    size_bytes: track.size_bytes ?? null,
    filename: track.filename ?? null,
    file_url: new URL(track.download_url, ORIGIN).toString(),
    from_cache: !!track.from_cache,
    expires_at: job.expires_at ? new Date(job.expires_at * 1000).toISOString() : null,
    quota_remaining: quotaRemaining,
  }
}

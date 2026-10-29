// lib/islami/sholat-timings.js — Jadwal sholat via Aladhan (direct) + fallback geocode Nominatim.
// Server-side untuk endpoint GET /api/sholat/timings.
// Ditulis untuk HABI REST API.
//
// Urutan:
//  1. timingsByCity — kota yang dikenal Aladhan.
//  2. Geocode nama kota via Nominatim (OSM) → timings by coordinates (kota kecil).
// Cache in-memory: hasil sukses per (tanggal, kota) seharian; kegagalan 10 menit.

import https from 'node:https'

const UA = 'HABI-REST-API/2.0 (prayer-time lookup; contact: habibistorecs@gmail.com)'

function ddMMyyyy(tz = 'Asia/Jakarta') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('day')}-${get('month')}-${get('year')}`
}

// PENTING: pakai https dengan family:4 (IPv4 paksa). VPS tidak punya rute IPv6
// dan resolver mengembalikan alamat v6 lebih dulu untuk api.aladhan.com —
// fetch bawaan Node menyerah (ETIMEDOUT/ENETUNREACH ±250ms) padahal IPv4 sehat.
function fetchJson(url, timeoutMs = 12000, redirects = 2) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': UA }, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume()
        resolve(fetchJson(new URL(res.headers.location, url).toString(), timeoutMs, redirects - 1))
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { body += c })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`))
        try { resolve(JSON.parse(body)) } catch { reject(new Error('Respons bukan JSON')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Timeout')))
    req.on('error', reject)
  })
}

async function geocodeCity(city) {
  const j = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(city)}`
  )
  const r = Array.isArray(j) ? j[0] : null
  if (!r || !r.lat || !r.lon) return null
  return { lat: r.lat, lon: r.lon, display: r.display_name || '' }
}

const okCache = new Map() // key: date|cityLower -> { at, value }
const failCache = new Map() // key: date|cityLower -> at
const FAIL_TTL_MS = 10 * 60 * 1000

export async function getSholatTimings(city) {
  const cleanCity = String(city || '').trim()
  if (!cleanCity) return null
  const date = ddMMyyyy()
  const key = `${date}|${cleanCity.toLowerCase()}`

  const ok = okCache.get(key)
  if (ok) return ok.value
  const failedAt = failCache.get(key)
  if (failedAt && Date.now() - failedAt < FAIL_TTL_MS) return null

  let value = null

  // Kandidat nama: asli + tanpa awalan "Kota/Kab./Kabupaten" (Aladhan sering
  // hanya kenal nama polosnya, mis. "Kota Cikande" gagal tapi "Cikande" bisa).
  const stripped = cleanCity.replace(/^(kota|kab\.?|kabupaten)\s+/i, '').trim()
  const candidates = stripped && stripped !== cleanCity ? [cleanCity, stripped] : [cleanCity]

  // 1. timingsByCity (method 20 = Kemenag RI)
  for (const cand of candidates) {
    if (value) break
    try {
      const j = await fetchJson(
        `https://api.aladhan.com/v1/timingsByCity/${date}?city=${encodeURIComponent(cand)}&country=Indonesia&method=20`
      )
      if (j?.data?.timings) value = { timings: j.data.timings, date: j.data.date || null, via: 'city' }
    } catch { /* lanjut kandidat berikut / fallback */ }
  }

  // 2. Fallback koordinat via geocode
  if (!value) {
    try {
      const geo = await geocodeCity(cleanCity)
      if (geo) {
        const j = await fetchJson(
          `https://api.aladhan.com/v1/timings/${date}?latitude=${geo.lat}&longitude=${geo.lon}&method=20`
        )
        if (j?.data?.timings) value = { timings: j.data.timings, date: j.data.date || null, via: 'coords', geo }
      }
    } catch { /* habis */ }
  }

  if (value) {
    okCache.set(key, { at: Date.now(), value })
    if (okCache.size > 500) okCache.clear()
    return value
  }
  failCache.set(key, Date.now())
  return null
}

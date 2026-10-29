// lib/tools/waifu.js — Gambar anime acak SFW (HABI REST API)
// Sumber gambar: nekos.best (API publik, kategori SFW).
// (Awalnya waifu.pics, tapi DNS host-nya tidak terjangkau dari VPS —
// diganti ke nekos.best yang terverifikasi jalan, build43.)
// Endpoint sendiri membungkusnya agar bot tidak tergantung langsung.

import https from 'node:https'

export const WAIFU_CATEGORIES = [
  'waifu', 'neko', 'kitsune', 'husbando', 'hug', 'kiss', 'pat', 'cuddle',
  'cry', 'blush', 'smile', 'wave', 'dance', 'slap', 'poke', 'wink', 'bite',
  'nom', 'highfive', 'handhold', 'kick', 'yeet', 'bonk', 'smug',
]

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': 'HABI-API/2.0', 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)) }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new Error('Respons sumber tidak valid')) } })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('Timeout mengambil gambar')) })
  })
}

export async function getWaifu(cat = 'waifu') {
  const c = String(cat || 'waifu').toLowerCase().trim()
  if (!WAIFU_CATEGORIES.includes(c)) {
    throw new Error(`Kategori "${c}" tidak ada. Pilihan: ${WAIFU_CATEGORIES.join(', ')}`)
  }
  const j = await httpsJson(`https://nekos.best/api/v2/${c}`)
  const item = j?.results?.[0]
  if (!item?.url) throw new Error('Sumber gambar tidak mengembalikan URL')
  return { url: item.url, category: c, artist: item.artist_name || '', anime: item.anime_name || '' }
}

export default getWaifu

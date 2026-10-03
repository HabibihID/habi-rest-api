// stalkX — Info profil X (Twitter) via endpoint publik.
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
// Prioritas: syndication follow-button info.json → oEmbed publish.twitter.com (fallback).

import { fetchJson, cleanUsername } from './_http.js'

export async function stalkX(username) {
  const u = cleanUsername(username)
  if (!u) throw new Error('Username wajib diisi')
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(u)) throw new Error('Username tidak valid')

  // Cara 1: syndication API (publik, tanpa auth)
  try {
    const j = await fetchJson(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(u)}`,
      { timeoutMs: 12000 }
    )
    const info = Array.isArray(j) ? j[0] : null
    if (info && info.screen_name) {
      return {
        username: info.screen_name,
        name: info.name || null,
        bio: null,
        followers: info.followers_count ?? null,
        following: info.following_count ?? null,
        tweets: null,
        profile_pic: info.profile_image_url_https || info.profile_image_url || null,
        is_verified: null,
      }
    }
  } catch {}

  // Cara 2: oEmbed publik (selalu tersedia tanpa auth)
  try {
    const j = await fetchJson(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(`https://x.com/${u}`)}`,
      { timeoutMs: 12000 }
    )
    if (j?.author_name) {
      // Ambil foto profil dari HTML embed
      const html = j.html || ''
      const imgM = html.match(/src=["'](https:\/\/pbs\.twimg\.com\/profile_images[^"']+)["']/)
      return {
        username: u,
        name: j.author_name,
        bio: null,
        followers: null,
        following: null,
        tweets: null,
        profile_pic: imgM ? imgM[1].replace(/_normal(\.\w+)$/, '$1') : null,
        is_verified: null,
      }
    }
  } catch {}

  throw new Error('Profil X tidak ditemukan atau X membatasi akses (butuh login/API key).')
}

export default { stalkX }

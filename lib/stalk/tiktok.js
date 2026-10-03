// stalkTiktok — Info profil TikTok via scraping publik (SIGI_STATE di HTML).
// Ditulis dari nol untuk HABI REST API. Tanpa API key.

import { fetchText, fetchJson, meta, cleanUsername } from './_http.js'

export async function stalkTiktok(username) {
  const u = cleanUsername(username)
  if (!u) throw new Error('Username wajib diisi')
  if (!/^[a-zA-Z0-9._]{2,24}$/.test(u)) throw new Error('Username tidak valid')

  let html
  try {
    html = await fetchText(`https://www.tiktok.com/@${u}`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    })
  } catch (e) {
    throw new Error(`TikTok tidak bisa diakses (${e.message})`)
  }

  // Cara 1: JSON SIGI_STATE di dalam HTML
  let data = null
  const m = html.match(/<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const j = JSON.parse(m[1])
      const userDetail = j?.UserModule?.users?.[u] || Object.values(j?.UserModule?.users || {})[0]
      const stats = j?.UserModule?.stats?.[u] || Object.values(j?.UserModule?.stats || {})[0]
      if (userDetail) data = { userDetail, stats }
    } catch {}
  }

  // Cara 2: meta tags (og:title, og:description, og:image)
  const title = meta(html, 'og:title') || ''
  const desc = meta(html, 'og:description') || ''
  const image = meta(html, 'og:image')

  if (!data && !title && !image) {
    // Cara 3 (fallback): oEmbed publik TikTok — hanya nama & konfirmasi akun ada
    try {
      const oe = await fetchJson(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${u}`)}`,
        { timeoutMs: 12000 }
      )
      if (oe?.author_name) {
        return {
          username: u,
          nickname: oe.author_name,
          bio: null,
          followers: null,
          following: null,
          likes: null,
          videos: null,
          profile_pic: null,
          is_verified: null,
          _note: 'Data statistik tidak tersedia — TikTok membatasi akses scraper.',
        }
      }
    } catch {}
    throw new Error('Profil tidak ditemukan atau TikTok membatasi akses (bot detection).')
  }

  if (data) {
    const ud = data.userDetail
    const st = data.stats || {}
    return {
      username: ud.uniqueId || u,
      nickname: ud.nickname || null,
      bio: ud.signature || null,
      followers: st.followerCount ?? null,
      following: st.followingCount ?? null,
      likes: st.heartCount ?? null,
      videos: st.videoCount ?? null,
      profile_pic: ud.avatarLarger || ud.avatarMedium || ud.avatarThumb || null,
      is_verified: ud.verified ?? null,
    }
  }

  // Fallback meta tags saja
  const followersM = desc.match(/([\d,.KM]+)\s*Followers/i)
  const likesM = desc.match(/([\d,.KM]+)\s*Likes/i)
  return {
    username: u,
    nickname: title.split('|')[0]?.trim() || null,
    bio: desc || null,
    followers: followersM ? followersM[1] : null,
    following: null,
    likes: likesM ? likesM[1] : null,
    videos: null,
    profile_pic: image,
    is_verified: null,
  }
}

export default { stalkTiktok }

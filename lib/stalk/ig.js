// stalkIg — Info profil Instagram via scraping publik (embed page).
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
// Instagram sering membatasi akses tanpa login; kalau diblokir, return error jelas.

import { fetchText, meta, cleanUsername, num } from './_http.js'

// "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from X"
function parseStats(desc = '') {
  const out = { followers: null, following: null, posts: null }
  const m1 = desc.match(/([\d,.KM]+)\s+Followers/i)
  const m2 = desc.match(/([\d,.KM]+)\s+Following/i)
  const m3 = desc.match(/([\d,.KM]+)\s+Posts/i)
  if (m1) out.followers = num(m1[1])
  if (m2) out.following = num(m2[1])
  if (m3) out.posts = num(m3[1])
  return out
}

export async function stalkIg(username) {
  const u = cleanUsername(username)
  if (!u) throw new Error('Username wajib diisi')
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(u)) throw new Error('Username tidak valid')

  // Embed page publik — tidak butuh login (kalau IG mengizinkan)
  let html
  try {
    html = await fetchText(`https://www.instagram.com/${u}/embed/`)
  } catch (e) {
    throw new Error(`Instagram tidak bisa diakses (${e.message}). Kemungkinan IG membatasi akses tanpa login.`)
  }
  if (/login|Log in/i.test(html) && !/og:title/i.test(html)) {
    throw new Error('Instagram meminta login — profil tidak bisa dibaca tanpa akun.')
  }

  const title = meta(html, 'og:title') || ''
  const desc = meta(html, 'og:description') || ''
  const image = meta(html, 'og:image')

  if (!title && !desc) throw new Error('Profil tidak ditemukan atau dibatasi Instagram.')

  const stats = parseStats(desc)
  // og:title: "username • Instagram photos and videos" atau "Full Name (@user) • Instagram..."
  const m = title.match(/^(.+?)\s*\(@([^)]+)\)/)
  const full_name = m ? m[1].trim() : title.split('•')[0].trim()

  return {
    username: u,
    full_name: full_name || null,
    bio: null, // embed page tidak menyediakan bio
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
    profile_pic: image,
    is_private: /private/i.test(desc) ? true : null,
    is_verified: null, // embed page tidak menyediakan status verifikasi
  }
}

export default { stalkIg }

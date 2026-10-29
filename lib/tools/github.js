// /api/github — Info profil GitHub
import { httpGet } from '../http.js'
import { cached } from '../cache.js'
import { throttle } from '../ratelimit.js'

const PROVIDER = 'github'

export async function githubInfo(username) {
  if (!username) throw new Error('Username wajib diisi')
  const u = String(username).trim().toLowerCase()
  // Profil GitHub jarang berubah → cache 30 menit
  return cached(`github:${u}`, 30 * 60 * 1000, async () => {
    await throttle(PROVIDER, 1000)
    let d
    try {
      d = await httpGet(`https://api.github.com/users/${encodeURIComponent(u)}`, {
        provider: PROVIDER,
        timeout: 15000,
        headers: { 'User-Agent': 'HABI-REST-API' },
      })
    } catch (err) {
      if (err?.status === 404) throw new Error('User tidak ditemukan')
      throw new Error('Gagal ambil data GitHub')
    }
    return {
      username: d.login,
      name: d.name,
      bio: d.bio,
      avatar: d.avatar_url,
      followers: d.followers,
      following: d.following,
      repos: d.public_repos,
      gists: d.public_gists,
      location: d.location,
      blog: d.blog,
      created_at: d.created_at,
      profile: d.html_url,
    }
  })
}

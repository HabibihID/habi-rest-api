// /api/github — Info profil GitHub
export async function githubInfo(username) {
  if (!username) throw new Error('Username wajib diisi')
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: { 'User-Agent': 'HABI-REST-API' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 404) throw new Error('User tidak ditemukan')
  if (!res.ok) throw new Error('Gagal ambil data GitHub')
  const d = await res.json()
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
}

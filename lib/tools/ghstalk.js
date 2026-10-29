// lib/tools/ghstalk.js — Stalk profil GitHub via API publik GitHub (tanpa token).
// Untuk endpoint GET /api/ghstalk?username=
// Ditulis untuk HABI REST API. Cache 10 menit (hemat rate limit GitHub 60/jam/IP).

import https from 'node:https'

const UA = 'HABI-REST-API/2.0 (github stalk)'

function fetchJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      family: 4, // VPS tanpa rute IPv6 — paksa IPv4 (lihat catatan sholat-timings)
      headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' },
      timeout: timeoutMs,
    }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { body += c })
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null)
        if (res.statusCode === 403) return reject(new Error('GitHub rate limit tercapai, coba lagi nanti.'))
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`GitHub HTTP ${res.statusCode}`))
        try { resolve(JSON.parse(body)) } catch { reject(new Error('Respons GitHub bukan JSON')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Timeout ke GitHub')))
    req.on('error', reject)
  })
}

const cache = new Map() // usernameLower -> { at, value }
const TTL = 10 * 60 * 1000

export async function ghstalk(username) {
  const u = String(username || '').trim().replace(/^@/, '')
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(u)) return null
  const key = u.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.value

  const user = await fetchJson(`https://api.github.com/users/${encodeURIComponent(u)}`)
  if (!user) return null

  let repos = []
  try {
    const r = await fetchJson(`https://api.github.com/users/${encodeURIComponent(u)}/repos?per_page=100&sort=pushed`)
    if (Array.isArray(r)) repos = r
  } catch { /* repo gagal tidak menggagalkan profil */ }

  const own = repos.filter((x) => !x.fork)
  const totalStars = own.reduce((a, x) => a + (x.stargazers_count || 0), 0)
  const langCount = {}
  for (const x of own) if (x.language) langCount[x.language] = (langCount[x.language] || 0) + 1
  const topLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  const topRepos = [...own]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 5)
    .map((x) => ({
      name: x.name,
      stars: x.stargazers_count || 0,
      forks: x.forks_count || 0,
      language: x.language || '-',
      description: x.description || '',
      url: x.html_url,
    }))

  const value = {
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url || '',
    bio: user.bio || '',
    company: user.company || '',
    location: user.location || '',
    blog: user.blog || '',
    twitter: user.twitter_username || '',
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    publicRepos: user.public_repos ?? 0,
    publicGists: user.public_gists ?? 0,
    createdAt: user.created_at || '',
    profileUrl: user.html_url,
    totalStars,
    topLangs,
    topRepos,
  }
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 200) cache.clear()
  return value
}

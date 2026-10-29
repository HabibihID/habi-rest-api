// Spotify Partner — search & metadata Spotify untuk HABI REST API.
// Diadaptasi dari Spotify Partner API Scraper (Zane) atas kiriman user 2026-10-21.
// Search via api-partner (persisted query, token anonim dari embed); metadata
// track/album via halaman embed. TIDAK termasuk download MP3 spotidown:
// endpoint download-nya kini mewajibkan login akun (HTTP 401 login_required).
const BASE = 'https://open.spotify.com'
const EMBED_BASE = 'https://embed.spotify.com/embed'
const TOKEN_API = 'https://clienttoken.spotify.com/v1/clienttoken'
const PARTNER_API = 'https://api-partner.spotify.com/pathfinder/v1/query'
const TIMEOUT = 20000
const BOOTSTRAP_TRACK = '4cOdK2wGLETKBW3PvgPWqT'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function req(url, { headers = {}, method = 'GET', body } = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
      body, signal: ac.signal, redirect: 'follow',
    })
    return { res, txt: await res.text() }
  } finally { clearTimeout(t) }
}

let sessionCache = null
async function getSession(force = false) {
  if (!force && sessionCache && Date.now() < sessionCache.expiryMs - 60000) return sessionCache
  const { txt } = await req(`${EMBED_BASE}/track/${BOOTSTRAP_TRACK}`)
  const m = txt.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('Session bootstrap gagal: __NEXT_DATA__ tidak ditemukan')
  const data = JSON.parse(m[1])
  const sess = data?.props?.pageProps?.state?.settings?.session
  if (!sess?.accessToken) throw new Error('Session bootstrap gagal: token tidak ditemukan')
  sessionCache = { accessToken: sess.accessToken, expiryMs: sess.accessTokenExpirationTimestampMs }
  return sessionCache
}

let clientTokenCache = null
async function getClientToken(force = false) {
  if (!force && clientTokenCache && Date.now() < clientTokenCache.expiryMs - 60000) return clientTokenCache
  const payload = {
    client_data: {
      client_version: '1.2.57.409.g175f186c', client_id: 'f6a40776580943a7bc5173125a1e8832',
      js_sdk_data: { device_brand: 'Chrome', device_model: 'Windows', os: 'Windows', os_version: '10', container_version: '0.0.0', device_id: '', device_type: 'computer', platform_identifier: 'web_player' },
    },
  }
  const { txt } = await req(TOKEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const d = JSON.parse(txt)
  if (!d.granted_token?.token) throw new Error('Client token gagal diambil')
  clientTokenCache = { token: d.granted_token.token, expiryMs: Date.now() + (d.granted_token.refresh_after_seconds ?? 3600) * 1000 }
  return clientTokenCache
}

const SEARCH_HASHES = [
  'eff59fa0a3d026b88b56fddbcf4bdfa16a186b8175a5c1a358c072e053c2e5b0',
  '21b3fe49546912ba782db5c47e9ef5a7dbd20329520ba0c7d0fcfadee671d24e',
  '3c9d3f60dac5dea3876b6db3f534192b1c1d90032c4233c1bbaba526db41eb31',
]

async function pathfinder(operationName, variables, hashCandidates) {
  let session = await getSession()
  let client = await getClientToken()
  let lastErr = null
  for (const hash of hashCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const params = new URLSearchParams({
        operationName,
        variables: JSON.stringify(variables),
        extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }),
      })
      const { res, txt } = await req(`${PARTNER_API}?${params}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Client-Token': client.token,
          Accept: 'application/json', 'Content-Type': 'application/json',
          Origin: BASE, Referer: `${BASE}/`, 'Spotify-App-Platform': 'WebPlayer',
        },
      })
      if (res.status === 401 || /token has expired/i.test(txt)) {
        session = await getSession(true)
        client = await getClientToken(true)
        continue
      }
      if (res.status === 400 && /unknown|not found|not supported|hash/i.test(txt)) { lastErr = new Error('Hash query tidak dikenal'); break }
      if (!res.ok) throw new Error(`Partner API HTTP ${res.status}`)
      return JSON.parse(txt)
    }
  }
  throw lastErr || new Error(`Semua kandidat hash gagal untuk ${operationName}`)
}

/* ---------------- Metadata via embed ---------------- */

function parseEmbed(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('__NEXT_DATA__ tidak ditemukan')
  const data = JSON.parse(m[1])
  const entity = data?.props?.pageProps?.state?.data?.entity
  if (!entity) throw new Error('Entity tidak ditemukan di embed page')
  return entity
}

async function embedEntity(type, id) {
  const { txt } = await req(`${EMBED_BASE}/${type}/${id}`)
  return parseEmbed(txt)
}

function mapTrack(t) {
  const id = (t.uri || '').split(':').pop() || null
  return {
    id,
    title: t.title || t.name || null,
    artists: (t.artists?.items || (Array.isArray(t.artists) ? t.artists : [])).map((a) => a.name || a.profile?.name).filter(Boolean),
    album: t.album?.name || null,
    albumId: (t.album?.uri || '').split(':').pop() || null,
    cover: t.album?.coverArt?.sources?.[0]?.url || t.visualIdentity?.image?.sources?.[0]?.url || null,
    durationMs: typeof t.duration === 'number' ? t.duration : (t.duration?.totalMilliseconds ?? null),
    previewUrl: t.audioPreview?.url || null,
    url: id ? `https://open.spotify.com/track/${id}` : null,
  }
}

const extract = (x) => x?.item?.data || x?.track || x?.data || x

export async function spSearch(term, { limit = 10, offset = 0 } = {}) {
  if (!term?.trim()) throw new Error('Kata kunci wajib diisi')
  const data = await pathfinder('searchDesktop', {
    searchTerm: term, offset, limit, numberOfTopResults: 5,
    includeAudiobooks: false, includePreReleases: true, includeAlbumPreReleases: false,
    includeAuthors: false, includeEpisodeContentRatingsV2: false,
  }, SEARCH_HASHES)
  const s = data?.data?.searchV2 || data?.data?.search
  if (!s) throw new Error('Format respons search tidak dikenal')
  const tracks = (s.tracksV2?.items || s.tracks?.items || []).map((x) => {
    const raw = extract(x)
    return mapTrack({ ...raw, album: raw?.album || raw?.albumOfTrack })
  }).filter((t) => t.id)
  const albums = (s.albumsV2?.items || s.albums?.items || []).map(extract).filter((x) => x?.uri).map((x) => ({
    id: x.uri.split(':').pop(),
    name: x.name || x.title || null,
    artists: (x.artists?.items || []).map((a) => a.profile?.name || a.name).filter(Boolean),
    cover: x.coverArt?.sources?.[0]?.url || null,
    year: x.date?.year || null,
    url: `https://open.spotify.com/album/${x.uri.split(':').pop()}`,
  }))
  const artists = (s.artistsV2?.items || s.artists?.items || []).map(extract).filter((x) => x?.uri).map((x) => ({
    id: x.uri.split(':').pop(),
    name: x.profile?.name || x.name || null,
    avatar: x.visuals?.avatarImage?.sources?.[0]?.url || null,
    url: `https://open.spotify.com/artist/${x.uri.split(':').pop()}`,
  }))
  return { query: term, total: (s.tracksV2 || s.tracks)?.totalCount ?? tracks.length, tracks, albums, artists }
}

export async function spTrack(idOrUrl) {
  const id = String(idOrUrl || '').replace(/^spotify:track:/, '').replace(/^.*\/track\//, '').split('?')[0]
  if (!id) throw new Error('ID track tidak valid')
  return mapTrack(await embedEntity('track', id))
}

export async function spAlbum(idOrUrl) {
  const id = String(idOrUrl || '').replace(/^spotify:album:/, '').replace(/^.*\/album\//, '').split('?')[0]
  if (!id) throw new Error('ID album tidak valid')
  const e = await embedEntity('album', id)
  const cover = e.visualIdentity?.image?.sources?.[0]?.url || null
  return {
    id,
    name: e.name || e.title || null,
    artists: (e.artists || []).map((a) => a.name).filter(Boolean),
    releaseDate: e.releaseDate?.isoString || null,
    cover,
    url: `https://open.spotify.com/album/${id}`,
    totalTracks: (e.trackList || []).length,
    tracks: (e.trackList || []).map((t) => mapTrack({ ...t, album: { name: e.name, uri: e.uri, coverArt: { sources: cover ? [{ url: cover }] : [] } } })),
  }
}

export default { spSearch, spTrack, spAlbum }

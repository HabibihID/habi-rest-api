// Apple Music — search & metadata katalog untuk HABI REST API.
// Di-port dari apple-music.js kiriman user 2026-10-21 (token web publik dari
// bundle music.apple.com -> amp-api.music.apple.com). Metadata saja, tanpa unduhan.
/**
 * apple-music.js — Single-file ESM wrapper + CLI untuk music.apple.com
 *
 * Node.js ≥ 18  |  Zero dependency
 *
 * CLI:
 *   node apple-music.js search "query"
 *   node apple-music.js song <id>
 *   node apple-music.js album <id>
 *   node apple-music.js artist <id>
 *   node apple-music.js playlist <id>
 *   node apple-music.js url <link>
 *   node apple-music.js charts
 *   node apple-music.js genres
 *   node apple-music.js storefronts
 *   node apple-music.js home
 *   node apple-music.js suggest "query"
 *   node apple-music.js token
 *
 * Library:
 *   import { search, getSong, charts, resolve } from "./apple-music.js";
 */

// ═══════════════════════════════════════════════════════════
// TOKEN
// ═══════════════════════════════════════════════════════════

let cachedToken = null;
let tokenExpiresAt = 0;

function decodeJwt(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function extractToken(text) {
  const m = text.match(/(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function findJsBundleUrl() {
  const res = await fetch("https://music.apple.com/us/browse", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`Gagal fetch music.apple.com: ${res.status}`);
  const html = await res.text();

  const scriptMatch =
    html.match(/src="(\/assets\/index[^"]+\.js)"/) ||
    html.match(/src="(\/assets\/[^"]*index[^"]*\.js)"/) ||
    html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);

  if (scriptMatch) {
    const src = scriptMatch[1];
    return src.startsWith("http") ? src : `https://music.apple.com${src}`;
  }

  const all = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const candidate = all.find((s) => /index|main|app/i.test(s));
  if (candidate) return candidate.startsWith("http") ? candidate : `https://music.apple.com${candidate}`;
  throw new Error("Tidak menemukan JS bundle di music.apple.com");
}

export async function fetchToken({ force = false } = {}) {
  if (!force && cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const jsUrl = await findJsBundleUrl();
  const res = await fetch(jsUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Gagal fetch JS bundle: ${res.status}`);

  const token = extractToken(await res.text());
  if (!token) throw new Error("Token tidak ditemukan di JS bundle. Struktur Apple mungkin berubah.");

  const decoded = decodeJwt(token);
  if (!decoded) throw new Error("Token invalid");

  cachedToken = token;
  tokenExpiresAt = (decoded.exp || Math.floor(Date.now() / 1000) + 3600) * 1000;
  return token;
}

export function setToken(jwt) {
  const decoded = decodeJwt(jwt);
  if (!decoded) throw new Error("Token JWT invalid");
  if (decoded.exp * 1000 < Date.now()) throw new Error("Token sudah expired");
  cachedToken = jwt;
  tokenExpiresAt = decoded.exp * 1000;
}

export function getToken() {
  return cachedToken;
}

export function clearToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ═══════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════

const BASE = "https://amp-api.music.apple.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function request(path, { params = {}, headers = {}, method = "GET", body } = {}) {
  let token = getToken();
  if (!token) token = await fetchToken();

  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method,
    headers: {
      Origin: "https://music.apple.com",
      "User-Agent": UA,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await fetchToken({ force: true });
    return request(path, { params, headers, method, body });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apple Music API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export function formatArtworkUrl(artwork, opts = {}) {
  if (!artwork?.url) return null;
  let url = artwork.url;
  const w = opts.width || opts.size || artwork.width || 600;
  const h = opts.height || opts.size || artwork.height || 600;
  if (opts.format) {
    const i = url.lastIndexOf(".");
    if (i !== -1) url = url.slice(0, i + 1) + opts.format;
  }
  return url.replace("{w}", w).replace("{h}", h);
}

/** Ringkas resource Apple jadi objek flat yang mudah dibaca */
export function simplify(item, artworkSize = 600) {
  if (!item) return item;
  const a = item.attributes || {};
  const type = item.type || "";
  const base = {
    id: item.id,
    type: type.replace(/s$/, "") || type, // songs -> song
    name: a.name || null,
    url: a.url || null,
    artwork: a.artwork ? formatArtworkUrl(a.artwork, { size: artworkSize }) : null,
  };

  if (type === "songs" || type === "song") {
    return {
      ...base,
      artist: a.artistName || null,
      album: a.albumName || null,
      durationSec: a.durationInMillis ? Math.round(a.durationInMillis / 1000) : null,
      releaseDate: a.releaseDate || null,
      isrc: a.isrc || null,
      genres: a.genreNames || [],
      trackNumber: a.trackNumber ?? null,
      discNumber: a.discNumber ?? null,
    };
  }
  if (type === "albums" || type === "album") {
    return {
      ...base,
      artist: a.artistName || null,
      trackCount: a.trackCount ?? null,
      releaseDate: a.releaseDate || null,
      upc: a.upc || null,
      genres: a.genreNames || [],
      recordLabel: a.recordLabel || null,
    };
  }
  if (type === "artists" || type === "artist") {
    return {
      ...base,
      genres: a.genreNames || [],
    };
  }
  if (type === "playlists" || type === "playlist") {
    return {
      ...base,
      curator: a.curatorName || null,
      description: a.description?.short || a.description?.standard || null,
      trackCount: a.trackCount ?? null,
      lastModified: a.lastModifiedDate || null,
    };
  }
  // fallback
  return {
    ...base,
    artist: a.artistName || a.curatorName || null,
    durationSec: a.durationInMillis ? Math.round(a.durationInMillis / 1000) : null,
    releaseDate: a.releaseDate || null,
  };
}

/** @deprecated alias */
export function enrich(item, artworkSize = 600) {
  return simplify(item, artworkSize);
}

export function parseUrl(input) {
  try {
    const u = new URL(input);
    if (!u.hostname.includes("music.apple.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    let storefront = "us";
    let type = null;
    let id = null;
    let songId = null;

    if (parts[0]?.length === 2) {
      storefront = parts[0];
      type = parts[1];
      id = parts[parts.length - 1];
    } else {
      type = parts[0];
      id = parts[parts.length - 1];
    }

    if (u.searchParams.has("i")) {
      songId = u.searchParams.get("i");
      type = "song";
    }

    const typeMap = {
      album: "albums",
      song: "songs",
      songs: "songs",
      artist: "artists",
      playlist: "playlists",
      "music-video": "music-videos",
      station: "stations",
    };

    return {
      storefront,
      type: typeMap[type] || type,
      id: songId || id,
      albumId: songId ? id : null,
      originalType: type,
    };
  } catch {
    return null;
  }
}

export async function search(term, options = {}) {
  const {
    country = "us",
    types = "songs,albums,artists,playlists",
    limit = 25,
    includeTop = true,
    lang = "en-US",
  } = options;

  const params = { term, types, limit, l: lang, platform: "web" };
  if (includeTop) params.with = "serverBubbles";

  const json = await request(`/v1/catalog/${country}/search`, { params });
  if (!json.results) return json;

  const keyMap = { song: "songs", album: "albums", artist: "artists", playlist: "playlists", top: "top" };
  const results = {};
  for (const [key, val] of Object.entries(json.results)) {
    const k = keyMap[key] || key;
    results[k] = (val.data || val).map((x) => simplify(x));
  }
  return results;
}

export async function suggestions(term, options = {}) {
  const {
    country = "us",
    limit = 10,
    lang = "en-US",
    types = "songs,albums,artists,playlists",
  } = options;
  const json = await request(`/v1/catalog/${country}/search/suggestions`, {
    params: {
      term,
      types,
      kinds: "terms,topResults",
      limit,
      l: lang,
      platform: "web",
    },
  });
  return json.results?.suggestions || json;
}

export async function get(type, id, options = {}) {
  const { country = "us", include, lang = "en-US" } = options;
  const params = { l: lang };
  if (include) params.include = Array.isArray(include) ? include.join(",") : include;
  const json = await request(`/v1/catalog/${country}/${type}/${id}`, { params });
  const item = json.data?.[0] || json;
  if (options.raw) return item;
  const simple = simplify(item);
  // tracks untuk album/playlist
  const tracks = item.relationships?.tracks?.data;
  if (tracks?.length) {
    simple.tracks = tracks.map((t) => simplify(t));
  }
  return simple;
}

export async function getSong(id, options = {}) {
  return get("songs", id, { include: options.include || "artists,albums", ...options });
}

export async function getAlbum(id, options = {}) {
  return get("albums", id, { include: options.include || "artists,tracks", ...options });
}

export async function getArtist(id, options = {}) {
  return get("artists", id, { include: options.include || "albums", ...options });
}

export async function getPlaylist(id, options = {}) {
  return get("playlists", id, { include: options.include || "tracks", ...options });
}

/** Terima ID mentah atau URL music.apple.com → { id, country, type } */
export function resolveIdOrUrl(input, expectedType) {
  if (!input) throw new Error("ID atau URL diperlukan");
  if (String(input).startsWith("http")) {
    const parsed = parseUrl(input);
    if (!parsed) throw new Error("URL tidak valid / bukan music.apple.com");
    if (expectedType && parsed.type !== expectedType && parsed.type !== expectedType + "s") {
      // allow playlist vs playlists etc — typeMap already pluralizes
    }
    return {
      id: parsed.id,
      country: parsed.storefront,
      type: parsed.type,
    };
  }
  return { id: input, country: null, type: expectedType };
}

export async function resolve(url, options = {}) {
  const parsed = parseUrl(url);
  if (!parsed) throw new Error("URL tidak valid / bukan music.apple.com");
  const { type, id, storefront } = parsed;
  const opts = { country: options.country || storefront, ...options };

  switch (type) {
    case "songs":
      return getSong(id, opts);
    case "albums":
      return getAlbum(id, opts);
    case "artists":
      return getArtist(id, opts);
    case "playlists":
      return getPlaylist(id, opts);
    default:
      return get(type, id, opts);
  }
}

export async function getByIsrc(isrc, options = {}) {
  const { country = "us", lang = "en-US" } = options;
  const json = await request(`/v1/catalog/${country}/songs`, {
    params: { "filter[isrc]": Array.isArray(isrc) ? isrc.join(",") : isrc, l: lang },
  });
  const data = (json.data || []).map((x) => simplify(x));
  if (Array.isArray(isrc)) return data;
  return data[0] || null;
}

export async function getByUpc(upc, options = {}) {
  const { country = "us", lang = "en-US" } = options;
  const json = await request(`/v1/catalog/${country}/albums`, {
    params: { "filter[upc]": Array.isArray(upc) ? upc.join(",") : upc, l: lang },
  });
  const data = (json.data || []).map((x) => simplify(x));
  if (Array.isArray(upc)) return data;
  return data[0] || null;
}

export async function charts(options = {}) {
  const {
    country = "us",
    types = "songs,albums,playlists",
    limit = 20,
    genre,
    chart,
  } = options;

  const params = { types, limit };
  if (genre) params.genre = genre;
  if (chart) params.chart = chart;

  const json = await request(`/v1/catalog/${country}/charts`, { params });
  const results = {};
  for (const [key, chartsArr] of Object.entries(json.results || {})) {
    results[key] = (chartsArr || []).map((c) => ({
      name: c.name,
      chart: c.chart,
      href: c.href,
      next: c.next,
      data: (c.data || []).map((x) => simplify(x)),
    }));
  }
  return results;
}

export async function genres(options = {}) {
  const { country = "us", limit = 50 } = options;
  const json = await request(`/v1/catalog/${country}/genres`, { params: { limit } });
  return (json.data || []).map((g) => ({
    id: g.id,
    name: g.attributes?.name,
    parentId: g.attributes?.parentId,
    url: g.attributes?.url,
  }));
}

export async function storefronts(options = {}) {
  const { limit = 200, lang = "en-US" } = options;
  const json = await request(`/v1/storefronts`, { params: { limit, l: lang } });
  return (json.data || []).map((s) => ({
    id: s.id,
    name: s.attributes?.name,
    defaultLanguageTag: s.attributes?.defaultLanguageTag,
    supportedLanguageTags: s.attributes?.supportedLanguageTags,
  }));
}

export async function home(options = {}) {
  const { country = "us", limit = 10 } = options;
  const [c, g] = await Promise.all([
    charts({ country, types: "songs,albums,playlists", limit }),
    genres({ country, limit: 15 }),
  ]);

  return {
    country,
    topSongs: c.songs?.[0]?.data || [],
    topAlbums: c.albums?.[0]?.data || [],
    topPlaylists: c.playlists?.[0]?.data || [],
    genres: g,
  };
}

// ═══════════════════════════════════════════════════════════
// CLI helpers
// ═══════════════════════════════════════════════════════════

function pretty(data) {
  console.log(JSON.stringify(data, null, 2));
}

function humanSong(song) {
  console.log(`🎵  ${song.name}`);
  console.log(`   Artist : ${song.artist || "-"}`);
  console.log(`   Album  : ${song.album || "-"}`);
  console.log(`   Durasi : ${song.durationSec ?? "-"}s`);
  console.log(`   ID     : ${song.id}`);
  console.log(`   URL    : ${song.url || "-"}`);
  if (song.artwork) console.log(`   Cover  : ${song.artwork}`);
  console.log();
}

function humanAlbum(album) {
  console.log(`💿  ${album.name}`);
  console.log(`   Artist : ${album.artist || "-"}`);
  console.log(`   Tracks : ${album.trackCount ?? "-"}`);
  console.log(`   Rilis  : ${album.releaseDate || "-"}`);
  console.log(`   ID     : ${album.id}`);
  console.log(`   URL    : ${album.url || "-"}`);
  if (album.artwork) console.log(`   Cover  : ${album.artwork}`);
  console.log();
}

function humanArtist(artist) {
  console.log(`🎤  ${artist.name}`);
  console.log(`   Genre  : ${(artist.genres || []).join(", ") || "-"}`);
  console.log(`   ID     : ${artist.id}`);
  console.log(`   URL    : ${artist.url || "-"}`);
  console.log();
}

function humanPlaylist(pl) {
  console.log(`📜  ${pl.name}`);
  console.log(`   Curator: ${pl.curator || "-"}`);
  console.log(`   ID     : ${pl.id}`);
  console.log(`   URL    : ${pl.url || "-"}`);
  console.log();
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

async function runCli(args) {
  const flags = {
    country: "us",
    limit: 10,
    json: true,
    human: false,
    types: "songs,albums,artists,playlists",
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-c" || a === "--country") flags.country = args[++i];
    else if (a === "-l" || a === "--limit") flags.limit = Number(args[++i]);
    else if (a === "-t" || a === "--types") flags.types = args[++i];
    else if (a === "--json" || a === "-j") flags.json = true;
    else if (a === "--human" || a === "-H") {
      flags.human = true;
      flags.json = false;
    } else if (a === "-h" || a === "--help") {
      console.log(`
Apple Music CLI — single file (Node ≥ 18)

Usage:
  node apple-music.js <command> [args] [options]

Commands:
  search <query>          Cari lagu / album / artist / playlist
  suggest <query>         Search suggestions
  song <id>               Detail lagu
  album <id>              Detail album + tracks
  artist <id>             Detail artist
  playlist <id>           Detail playlist + tracks
  url <link>              Resolve URL music.apple.com
  charts                  Top charts (songs, albums, playlists)
  genres                  Daftar genre
  storefronts             Daftar negara / storefront
  home                    Ringkasan: top songs + albums + playlists + genres
  token                   Tampilkan anonymous token

Options:
  -c, --country <code>    Storefront (us, id, jp, gb, ...)   [default: us]
  -l, --limit <n>         Limit hasil                        [default: 10]
  -t, --types <types>     Filter search types
  -j, --json              Output JSON pretty (default)
  -H, --human             Output human-readable
  -h, --help              Help

Contoh:
  node apple-music.js search "never gonna give you up" -l 5
  node apple-music.js song 1559885421
  node apple-music.js charts -c id -l 20
  node apple-music.js home -c us
  node apple-music.js search "tulus" -c id -l 5
  node apple-music.js url "https://music.apple.com/us/album/..." --human
`);
      return;
    } else positional.push(a);
  }

  const [cmd, ...rest] = positional;
  if (!cmd) {
    console.error("Perintah diperlukan. Pakai --help");
    process.exit(1);
  }

  try {
    switch (cmd) {
      case "search": {
        const query = rest.join(" ");
        if (!query) throw new Error("Query kosong");
        const results = await search(query, {
          country: flags.country,
          limit: flags.limit,
          types: flags.types,
        });
        if (flags.human) {
          const songs = results.songs || results.song || [];
          const albums = results.albums || results.album || [];
          const artists = results.artists || results.artist || [];
          const playlists = results.playlists || results.playlist || [];
          if (songs.length) {
            console.log("=== SONGS ===");
            songs.slice(0, flags.limit).forEach(humanSong);
          }
          if (albums.length) {
            console.log("=== ALBUMS ===");
            albums.slice(0, flags.limit).forEach(humanAlbum);
          }
          if (artists.length) {
            console.log("=== ARTISTS ===");
            artists.slice(0, flags.limit).forEach(humanArtist);
          }
          if (playlists.length) {
            console.log("=== PLAYLISTS ===");
            playlists.slice(0, flags.limit).forEach(humanPlaylist);
          }
        } else {
          pretty(results);
        }
        break;
      }

      case "suggest": {
        const query = rest.join(" ");
        if (!query) throw new Error("Query kosong");
        pretty(await suggestions(query, { country: flags.country }));
        break;
      }

      case "song": {
        const r = resolveIdOrUrl(rest[0], "songs");
        const song = await getSong(r.id, { country: r.country || flags.country });
        flags.human ? humanSong(song) : pretty(song);
        break;
      }

      case "album": {
        const r = resolveIdOrUrl(rest[0], "albums");
        const album = await getAlbum(r.id, { country: r.country || flags.country });
        if (flags.human) {
          humanAlbum(album);
          const tracks = album.tracks || [];
          if (tracks.length) {
            console.log("--- Tracks ---");
            tracks.forEach((t, i) => {
              console.log(`${String(i + 1).padStart(2)}. ${t.name} (${t.durationSec ?? "?"}s)`);
            });
          }
        } else {
          pretty(album);
        }
        break;
      }

      case "artist": {
        const r = resolveIdOrUrl(rest[0], "artists");
        const artist = await getArtist(r.id, { country: r.country || flags.country });
        flags.human ? humanArtist(artist) : pretty(artist);
        break;
      }

      case "playlist": {
        const r = resolveIdOrUrl(rest[0], "playlists");
        const pl = await getPlaylist(r.id, { country: r.country || flags.country });
        if (flags.human) {
          humanPlaylist(pl);
          const tracks = pl.tracks || [];
          tracks.slice(0, 30).forEach((t, i) => {
            console.log(`${String(i + 1).padStart(2)}. ${t.name} — ${t.artist || ""}`);
          });
          if (tracks.length > 30) console.log(`... +${tracks.length - 30} lagu`);
        } else {
          pretty(pl);
        }
        break;
      }

      case "url": {
        const link = rest[0];
        if (!link) throw new Error("URL diperlukan");
        const data = await resolve(link, { country: flags.country });
        if (flags.human) {
          const type = data.type;
          if (type === "songs") humanSong(data);
          else if (type === "albums") humanAlbum(data);
          else if (type === "artists") humanArtist(data);
          else if (type === "playlists") humanPlaylist(data);
          else pretty(data);
        } else {
          pretty(data);
        }
        break;
      }

      case "charts": {
        const data = await charts({
          country: flags.country,
          limit: flags.limit,
          types: "songs,albums,playlists",
        });
        pretty(data);
        break;
      }

      case "genres": {
        pretty(await genres({ country: flags.country, limit: flags.limit }));
        break;
      }

      case "storefronts": {
        pretty(await storefronts({ limit: flags.limit > 10 ? flags.limit : 200 }));
        break;
      }

      case "home": {
        pretty(await home({ country: flags.country, limit: flags.limit }));
        break;
      }

      case "token": {
        pretty({ token: await fetchToken({ force: true }) });
        break;
      }

      default:
        console.error(`Perintah tidak dikenal: ${cmd}`);
        console.error("Pakai --help");
        process.exit(1);
    }
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("apple-music.js") || process.argv[1].includes("apple-music"));

if (isMain) {
  runCli(process.argv.slice(2));
}

export default {
  fetchToken,
  setToken,
  getToken,
  clearToken,
  request,
  formatArtworkUrl,
  simplify,
  enrich,
  parseUrl,
  resolveIdOrUrl,
  search,
  suggestions,
  get,
  getSong,
  getAlbum,
  getArtist,
  getPlaylist,
  resolve,
  getByIsrc,
  getByUpc,
  charts,
  genres,
  storefronts,
  home,
};

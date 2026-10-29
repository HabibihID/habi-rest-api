// ISPU — kualitas udara resmi KLHK (ispu.kemenlh.go.id) untuk HABI REST API.
// Di-port dari ispu.js kiriman user 2026-10-21 (token frontend publik situsnya).
/**
 * ISPU Indonesia — Durable air-quality wrapper (Node.js ESM)
 * ===========================================================
 * Sumber resmi: Kementerian Lingkungan Hidup / BPLH
 * Portal     : https://ispu.kemenlh.go.id
 * API        : https://ispu.kemenlh.go.id/apiweb
 *
 * Token JWT diambil OTOMATIS dari bundle frontend website
 * (tidak perlu copy manual). Cache token di memory.
 *
 * ── Module ──────────────────────────────────────────────────
 *   import ISPU, { ispuCategory } from './ispu.js';
 *   const aq = new ISPU();
 *   const all = await aq.all();
 *   const jkt = await aq.search('jakarta');
 *   const rank = await aq.ranking({ limit: 15, provinsi: 'Kalimantan' });
 *   const one  = await aq.station('PALANGKARAYA');
 *
 * ── CLI ─────────────────────────────────────────────────────
 *   node ispu.js summary
 *   node ispu.js ranking --limit=20 --provinsi="Jawa Barat"
 *   node ispu.js search --q=bandung
 *   node ispu.js station --id=PALANGKARAYA
 *   node ispu.js provinsi --name="DKI Jakarta"
 *   node ispu.js stations
 *   node ispu.js list-provinsi
 */

const API_BASE = 'https://ispu.kemenlh.go.id/apiweb';
const APP_URL = 'https://ispu.kemenlh.go.id/app/';

/** Fallback jika auto-fetch gagal (token publik yang tertanam di frontend). */
const FALLBACK_TOKEN =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ0eXBlIjoiaXNwdS5rZW1lbmxoLmdvLmlkIiwia2V5IjoiRlB4ZnFSQzlKTzY1ZmpxRiIsInNlY3JldCI6Ijk1M2Q0NzZhLTllMDktNDQzNy05OGQ1LTg4ODQwYmIxOThmMCJ9.bkluNcKYjhgBor57qU04_LTvnKSSULUIJ8B2IOV20Yvx996vfWJReM7S-NKYIyycJ3WiORm8kqorzl0aTLrWCQ';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── Helpers ────────────────────────────────────────────────

export class ISPUError extends Error {
  constructor(message, { status, response } = {}) {
    super(message);
    this.name = 'ISPUError';
    this.status = status ?? null;
    this.response = response ?? null;
  }
}

/**
 * Kategori ISPU — Permen LHK No. 14 Tahun 2020
 */
export function ispuCategory(val) {
  const n = Number(val);
  if (val == null || Number.isNaN(n) || n < 0) return null;
  if (n <= 50)
    return {
      code: 1,
      name: 'Baik',
      nameEn: 'Good',
      color: '#00e400',
      range: '0-50',
      advice: 'Tidak ada dampak kesehatan.',
    };
  if (n <= 100)
    return {
      code: 2,
      name: 'Sedang',
      nameEn: 'Moderate',
      color: '#0066ff',
      range: '51-100',
      advice: 'Masih dapat diterima; kelompok sensitif waspada.',
    };
  if (n <= 200)
    return {
      code: 3,
      name: 'Tidak Sehat',
      nameEn: 'Unhealthy',
      color: '#ffcc00',
      range: '101-200',
      advice: 'Kurangi aktivitas di luar, terutama kelompok sensitif.',
    };
  if (n <= 300)
    return {
      code: 4,
      name: 'Sangat Tidak Sehat',
      nameEn: 'Very Unhealthy',
      color: '#ff0000',
      range: '201-300',
      advice: 'Hindari aktivitas luar ruangan.',
    };
  return {
    code: 5,
    name: 'Berbahaya',
    nameEn: 'Hazardous',
    color: '#000000',
    range: '≥301',
    advice: 'Tetap di dalam ruangan; dampak kesehatan serius.',
  };
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function stripHtml(s) {
  if (!s) return null;
  return (
    String(s)
      .replace(/<\/?sub>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() || null
  );
}

function normalizeCategoryName(raw) {
  if (!raw) return null;
  const u = String(raw).toUpperCase();
  if (u.includes('BAIK') && !u.includes('TIDAK')) return 'Baik';
  if (u.includes('SEDANG')) return 'Sedang';
  if (u.includes('SANGAT')) return 'Sangat Tidak Sehat';
  if (u.includes('TIDAK SEHAT')) return 'Tidak Sehat';
  if (u.includes('BERBAHAYA')) return 'Berbahaya';
  return stripHtml(raw);
}

function tipeLabel(t) {
  if (t === '0' || t === 0) return 'KLH/BPLH';
  if (t === '1' || t === 1) return 'Integrasi';
  return t != null ? String(t) : null;
}

function mapHist(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => ({
    nilai: num(x?.nilai),
    warna: x?.warna ?? null,
  }));
}

function normalizeStation(row, { includeRaw = false } = {}) {
  if (!row || typeof row !== 'object') return null;

  const ispu = num(row.val);
  const catName =
    normalizeCategoryName(row.cat) ||
    normalizeCategoryName(row.kategori?.nilai) ||
    ispuCategory(ispu)?.name ||
    null;

  const out = {
    id: row.id_stasiun ?? null,
    nama: row.nama ?? null,
    kota: row.kota ?? null,
    provinsi: row.provinsi ?? null,
    kelurahan: row.kelurahan || null,
    kecamatan: row.kecamatan || null,
    alamat: row.alamat || null,
    kawasan: row.p3e || null,
    lat: num(row.lat),
    lon: num(row.lon),
    ispu,
    kategori: catName,
    kategoriDetail: ispuCategory(ispu),
    parameterKritis: stripHtml(row.param),
    tipe: row.tipe_text || tipeLabel(row.tipe),
    timezone: row.time_z || 'WIB',
    waktu: row.waktu || null,
    waktuText: row.waktu_text || null,
    maintenance: row.is_maintenance === '1' || row.is_maintenance === 1,
    autoValidation: row.auto_validation === '1' || row.auto_validation === 1,
    konsentrasi: {
      pm10: num(row.a_pm10),
      pm25: num(row.a_pm25),
      so2: num(row.a_so2),
      co: num(row.a_co),
      o3: num(row.a_o3),
      no2: num(row.a_no2),
      hc: num(row.a_hc),
    },
    ispuPerParameter: {
      pm10: num(row.t_pm10) ?? num(row.pm10),
      pm25: num(row.t_pm25) ?? num(row.pm25),
      so2: num(row.t_so2) ?? num(row.so2),
      co: num(row.t_co) ?? num(row.co),
      o3: num(row.t_o3) ?? num(row.o3),
      no2: num(row.t_no2) ?? num(row.no2),
      hc: num(row.t_hc) ?? num(row.hc),
    },
  };

  if (row.waktu_24 || row.pm25_24_rev || row.pm10_24_rev) {
    out.histori24jam = {
      waktu: Array.isArray(row.waktu_24) ? row.waktu_24 : null,
      pm25: mapHist(row.pm25_24_rev),
      pm10: mapHist(row.pm10_24_rev),
    };
  }

  if (includeRaw) out.raw = row;
  return out;
}

function stripRaw(list) {
  return list.map(({ raw, ...rest }) => rest);
}

/**
 * Ambil JWT dari bundle Angular frontend ISPU.
 * Cari main.*.js di halaman app, lalu ekstrak string eyJ...
 */
async function fetchTokenFromFrontend(timeout = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);

  try {
    const htmlRes = await fetch(APP_URL, {
      headers: {
        Accept: 'text/html',
        'User-Agent': UA,
      },
      signal: ac.signal,
      redirect: 'follow',
    });
    const html = await htmlRes.text();

    // main.<hash>.js
    const mainMatch =
      html.match(/src="(main\.[a-f0-9]+\.js)"/i) ||
      html.match(/(main\.[a-f0-9]+\.js)/i);
    if (!mainMatch) {
      throw new Error('main.js tidak ditemukan di halaman app');
    }

    let mainUrl = mainMatch[1];
    if (!mainUrl.startsWith('http')) {
      mainUrl = new URL(mainUrl, APP_URL).href;
    }

    const jsRes = await fetch(mainUrl, {
      headers: { Accept: '*/*', 'User-Agent': UA },
      signal: ac.signal,
    });
    const js = await jsRes.text();

    // JWT HS512 yang dipakai Authorization
    const jwtRe =
      /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    const found = js.match(jwtRe);
    if (!found || !found.length) {
      throw new Error('JWT tidak ditemukan di main.js');
    }

    // pilih yang payload-nya mengandung ispu / kemenlh
    for (const tok of found) {
      try {
        const payload = JSON.parse(
          Buffer.from(tok.split('.')[1], 'base64url').toString('utf8')
        );
        if (
          String(payload.type || '').includes('ispu') ||
          String(payload.type || '').includes('kemenlh')
        ) {
          return tok;
        }
      } catch {
        /* skip */
      }
    }
    // fallback: JWT terpanjang (biasanya yang benar)
    return found.sort((a, b) => b.length - a.length)[0];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Client ─────────────────────────────────────────────────

export class ISPU {
  /**
   * @param {object} [opts]
   * @param {string}  [opts.token]      Paksa token (skip auto-fetch)
   * @param {boolean} [opts.autoToken]  default true — ambil dari frontend
   * @param {number}  [opts.timeout]    ms
   * @param {number}  [opts.cacheTtl]   ms cache data stasiun
   * @param {number}  [opts.tokenTtl]   ms cache token (default 6 jam)
   */
  constructor(opts = {}) {
    this._manualToken = opts.token || process.env.ISPU_TOKEN || null;
    this.autoToken = opts.autoToken !== false;
    this.timeout = opts.timeout ?? 20_000;
    this.cacheTtl = opts.cacheTtl ?? 5 * 60 * 1000;
    this.tokenTtl = opts.tokenTtl ?? 6 * 60 * 60 * 1000;

    this._token = this._manualToken;
    this._tokenAt = this._manualToken ? Date.now() : 0;
    this._tokenPromise = null;

    this._cache = null;
    this._cacheAt = 0;
  }

  /** Paksa set token manual */
  setToken(token) {
    this._token = token;
    this._tokenAt = Date.now();
    this._manualToken = token;
    this._cache = null;
  }

  /**
   * Pastikan ada token valid (auto-fetch jika perlu)
   */
  async ensureToken({ force = false } = {}) {
    if (this._manualToken && !force) {
      this._token = this._manualToken;
      return this._token;
    }

    const fresh =
      this._token &&
      Date.now() - this._tokenAt < this.tokenTtl &&
      !force;

    if (fresh) return this._token;

    // dedupe concurrent fetch
    if (this._tokenPromise) return this._tokenPromise;

    this._tokenPromise = (async () => {
      try {
        if (this.autoToken) {
          const tok = await fetchTokenFromFrontend(this.timeout);
          this._token = tok;
          this._tokenAt = Date.now();
          return tok;
        }
      } catch (e) {
        // fallback ke token bawaan
        if (!this._token) {
          this._token = FALLBACK_TOKEN;
          this._tokenAt = Date.now();
        }
        return this._token;
      } finally {
        this._tokenPromise = null;
      }
      if (!this._token) {
        this._token = FALLBACK_TOKEN;
        this._tokenAt = Date.now();
      }
      return this._token;
    })();

    return this._tokenPromise;
  }

  /** @private */
  async _get(path) {
    await this.ensureToken();

    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeout);

    try {
      let res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this._token}`,
          Referer: APP_URL,
          Origin: 'https://ispu.kemenlh.go.id',
          'User-Agent': UA,
        },
        signal: ac.signal,
      });

      let body = await res.json().catch(() => ({}));
      let code = body?.status?.code;

      // 401 → refresh token sekali lalu retry
      if (
        (res.status === 401 || code === 401) &&
        this.autoToken &&
        !this._manualToken
      ) {
        await this.ensureToken({ force: true });
        res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this._token}`,
            Referer: APP_URL,
            Origin: 'https://ispu.kemenlh.go.id',
            'User-Agent': UA,
          },
          signal: ac.signal,
        });
        body = await res.json().catch(() => ({}));
        code = body?.status?.code;
      }

      if (res.status === 401 || code === 401) {
        throw new ISPUError(
          'Unauthorized (401) meski sudah refresh token. Coba set ISPU_TOKEN manual.',
          { status: 401, response: body }
        );
      }
      if (!res.ok || (code != null && code !== 200)) {
        throw new ISPUError(body?.status?.desc || `HTTP ${res.status}`, {
          status: res.status,
          response: body,
        });
      }
      return body;
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new ISPUError(`Request timeout (${this.timeout}ms)`);
      }
      if (e instanceof ISPUError) throw e;
      throw new ISPUError(e.message || 'Network error');
    } finally {
      clearTimeout(t);
    }
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Semua stasiun realtime
   * @param {{ force?: boolean, includeRaw?: boolean }} [opts]
   */
  async all({ force = false, includeRaw = false } = {}) {
    const now = Date.now();
    if (!force && this._cache && now - this._cacheAt < this.cacheTtl) {
      const stations = includeRaw
        ? this._cache.stations
        : stripRaw(this._cache.stations);
      return { ...this._cache, stations };
    }

    const data = await this._get('/stasiun');
    const stations = (data.rows || []).map((r) =>
      normalizeStation(r, { includeRaw: true })
    );

    this._cache = {
      total: data.total ?? stations.length,
      updated: stations.find((s) => s?.waktu)?.waktu ?? null,
      stations,
      source: 'https://ispu.kemenlh.go.id',
      sourceApi: `${API_BASE}/stasiun`,
      scrapedAt: new Date().toISOString(),
    };
    this._cacheAt = now;

    return {
      ...this._cache,
      stations: includeRaw ? stations : stripRaw(stations),
    };
  }

  stations(opts) {
    return this.all(opts);
  }

  /**
   * Detail stasiun (+ histori 24 jam)
   * @param {string} id
   */
  async station(id, { includeRaw = false } = {}) {
    if (!id) throw new ISPUError('id stasiun wajib');
    const data = await this._get(
      `/stasiun/detail/id/${encodeURIComponent(id)}`
    );
    const row = data.rows?.[0] ?? data.row ?? data;
    const s = normalizeStation(row, { includeRaw });
    if (!s) throw new ISPUError(`Stasiun tidak ditemukan: ${id}`);
    return s;
  }

  /**
   * Cari nama / kota / provinsi / id
   * @param {string} query
   */
  async search(query, { includeRaw = false } = {}) {
    const q = String(query ?? '')
      .toLowerCase()
      .trim();
    if (!q) throw new ISPUError('query wajib');

    const all = await this.all({ includeRaw: true });
    const matched = all.stations.filter((s) => {
      const hay = [s.id, s.nama, s.kota, s.provinsi, s.alamat, s.kawasan]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    return {
      query: q,
      total: matched.length,
      updated: all.updated,
      stations: includeRaw ? matched : stripRaw(matched),
      scrapedAt: all.scrapedAt,
    };
  }

  /**
   * Ranking ISPU tertinggi
   * @param {{ limit?: number, provinsi?: string, kota?: string }} [opts]
   */
  async ranking({ limit = 20, provinsi, kota } = {}) {
    let list = (await this.all({ includeRaw: true })).stations.filter(
      (s) => s.ispu != null && !s.maintenance
    );

    if (provinsi) {
      const p = provinsi.toLowerCase();
      list = list.filter((s) => (s.provinsi || '').toLowerCase().includes(p));
    }
    if (kota) {
      const k = kota.toLowerCase();
      list = list.filter(
        (s) =>
          (s.kota || '').toLowerCase().includes(k) ||
          (s.nama || '').toLowerCase().includes(k)
      );
    }

    list.sort((a, b) => (b.ispu || 0) - (a.ispu || 0));
    const sliced = list.slice(0, limit);

    return {
      total: list.length,
      limit,
      filter: { provinsi: provinsi || null, kota: kota || null },
      updated: sliced[0]?.waktu || null,
      stations: stripRaw(sliced.map((s, i) => ({ rank: i + 1, ...s }))),
      scrapedAt: new Date().toISOString(),
    };
  }

  async byProvinsi(name) {
    if (!name) throw new ISPUError('nama provinsi wajib');
    const p = name.toLowerCase();
    const all = await this.all({ includeRaw: true });
    const stations = all.stations.filter((s) =>
      (s.provinsi || '').toLowerCase().includes(p)
    );
    return {
      provinsi: name,
      total: stations.length,
      updated: all.updated,
      stations: stripRaw(stations),
      scrapedAt: all.scrapedAt,
    };
  }

  async byKota(name) {
    if (!name) throw new ISPUError('nama kota wajib');
    const k = name.toLowerCase();
    const all = await this.all({ includeRaw: true });
    const stations = all.stations.filter(
      (s) =>
        (s.kota || '').toLowerCase().includes(k) ||
        (s.nama || '').toLowerCase().includes(k)
    );
    return {
      kota: name,
      total: stations.length,
      updated: all.updated,
      stations: stripRaw(stations),
      scrapedAt: all.scrapedAt,
    };
  }

  async listProvinsi() {
    const all = await this.all({ includeRaw: true });
    const map = new Map();

    for (const s of all.stations) {
      const key = s.provinsi || 'Tidak diketahui';
      if (!map.has(key)) {
        map.set(key, {
          provinsi: key,
          count: 0,
          ispuSum: 0,
          ispuN: 0,
          stations: [],
        });
      }
      const g = map.get(key);
      g.count++;
      if (s.ispu != null) {
        g.ispuSum += s.ispu;
        g.ispuN++;
      }
      g.stations.push({
        id: s.id,
        nama: s.nama,
        kota: s.kota,
        ispu: s.ispu,
        kategori: s.kategori,
      });
    }

    const list = [...map.values()]
      .map((g) => ({
        provinsi: g.provinsi,
        jumlahStasiun: g.count,
        ispuRataRata: g.ispuN ? Math.round(g.ispuSum / g.ispuN) : null,
        stations: g.stations.sort((a, b) => (b.ispu || 0) - (a.ispu || 0)),
      }))
      .sort((a, b) => (b.ispuRataRata || 0) - (a.ispuRataRata || 0));

    return {
      total: list.length,
      updated: all.updated,
      provinsi: list,
      scrapedAt: all.scrapedAt,
    };
  }

  async summary() {
    const all = await this.all({ includeRaw: true });
    const active = all.stations.filter((s) => s.ispu != null && !s.maintenance);
    const sorted = [...active].sort((a, b) => (b.ispu || 0) - (a.ispu || 0));

    const counts = {
      Baik: 0,
      Sedang: 0,
      'Tidak Sehat': 0,
      'Sangat Tidak Sehat': 0,
      Berbahaya: 0,
    };
    for (const s of active) {
      const k = s.kategori;
      if (k && counts[k] !== undefined) counts[k]++;
    }

    const pick = (s, i) => ({
      rank: i + 1,
      id: s.id,
      nama: s.nama,
      kota: s.kota,
      provinsi: s.provinsi,
      ispu: s.ispu,
      kategori: s.kategori,
      parameterKritis: s.parameterKritis,
      lat: s.lat,
      lon: s.lon,
    });

    return {
      total: active.length,
      updated: all.updated,
      kategoriCount: counts,
      topPolusi: sorted.slice(0, 10).map(pick),
      topBersih: [...sorted].reverse().slice(0, 10).map(pick),
      source: all.source,
      scrapedAt: all.scrapedAt,
    };
  }
}

export default ISPU;

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

// ---- Singleton helpers ----
const ispu = new ISPU()
export const ispuSummary = () => ispu.summary()
export const ispuSearch = (q) => ispu.search(q)
export const ispuRanking = (opts = {}) => ispu.ranking(opts)
export const ispuStation = (id) => ispu.station(id)
export const ispuProvinsi = (name) => ispu.byProvinsi(name)

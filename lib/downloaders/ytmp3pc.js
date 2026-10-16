// ytmp3pc — YouTube info/search/convert via ytmp3pc.com + ytzyar.cc (pihak ketiga).
// Dibungkus jadi module untuk REST API HABI.
// CATATAN: ini pakai API orang (bukan infrastruktur sendiri) — pengecualian atas minta user.

import { request as httpReq } from "node:http";
import { request as httpsReq } from "node:https";

const SITE = "https://ytmp3pc.com";
const API_INFO = "/hP2pPvYldCo";
const API_SEARCH = "/J0GPK30qWps";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT = 30_000;
const CONV_ORIGIN = "https://nodex2.ytzyar.cc";
const MUSIC_BASE = "https://ytzyar.cc";
const BUCKET = "https://bucketx2.ytzyar.cc";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

function req(url, { method = "GET", headers = {}, body, timeout = TIMEOUT, maxRedirect = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? httpReq : httpsReq;
    const rq = lib({ protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === "http:" ? 80 : 443), path: u.pathname + u.search, method, headers: { "User-Agent": UA, ...headers } },
      (rs) => {
        const { statusCode = 0, headers: rh } = rs;
        if (statusCode >= 300 && statusCode < 400 && rh.location && maxRedirect > 0) {
          rs.resume();
          return resolve(req(new URL(rh.location, url).toString(), { method: "GET", headers, body: undefined, timeout, maxRedirect: maxRedirect - 1 }));
        }
        let data = "", n = 0;
        rs.on("data", (c) => { n += c.length; if (n > 500_000) { rs.resume(); return resolve({ status: statusCode, headers: rh, body: data, truncated: true }); } data += c; });
        rs.on("end", () => resolve({ status: statusCode, headers: rh, body: data }));
      });
    rq.setTimeout(timeout, () => rq.destroy(new Error("timeout")));
    rq.on("error", reject);
    if (body) rq.write(body);
    rq.end();
  });
}

async function reqJson(url, opts = {}) {
  const r = await req(url, opts);
  let j = null;
  try { j = JSON.parse(r.body); } catch {}
  return { ...r, json: j };
}

function head(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const rq = httpsReq({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: "HEAD", headers: { "User-Agent": UA, ...headers } },
      (rs) => { rs.resume(); resolve({ status: rs.statusCode, headers: rs.headers }); });
    rq.setTimeout(TIMEOUT, () => rq.destroy(new Error("timeout")));
    rq.on("error", reject);
    rq.end();
  });
}

// Download file dengan headers yang benar, return Buffer
function downloadFile(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? httpReq : httpsReq;
    const rq = lib({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: "GET", headers: { "User-Agent": UA, ...headers } },
      (rs) => {
        if (rs.statusCode >= 300 && rs.statusCode < 400 && rs.headers.location) {
          rs.resume();
          return resolve(downloadFile(new URL(rs.headers.location, url).toString(), headers));
        }
        if (rs.statusCode !== 200) { rs.resume(); return reject(new Error(`download HTTP ${rs.statusCode}`)); }
        const chunks = [];
        rs.on("data", (c) => chunks.push(c));
        rs.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: rs.headers["content-type"] || "", filename: rs.headers["content-disposition"] || "" }));
      });
    rq.setTimeout(180000, () => rq.destroy(new Error("download timeout")));
    rq.on("error", reject);
    rq.end();
  });
}

function token(videoId) {
  const a = String(videoId).toLowerCase();
  let d = 0;
  for (let o = 0; o < a.length; o++) { d += a.charCodeAt(o); d += d << 10; d ^= d >>> 6; }
  d += d << 3; d ^= d >>> 11; d += d << 15;
  return d >>> 0;
}

export function extractId(input) {
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const pats = [/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/, /[?&]v=([A-Za-z0-9_-]{11})/];
  for (const p of pats) { const m = s.match(p); if (m) return m[1]; }
  throw new Error(`videoId tidak dikenali: ${s}`);
}

function convHeaders(extra = {}) { return { Referer: `${CONV_ORIGIN}/`, Origin: CONV_ORIGIN, ...extra }; }
export function getConvHeaders() { return convHeaders(); }

export async function siteInfo(videoId, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const r = await reqJson(`${SITE}${API_INFO}?v=${encodeURIComponent(videoId)}`, { headers: { Referer: `${SITE}/` } });
    if (r.json) return { videoId, title: dec(r.json.title), author: dec(r.json.author), description: dec(r.json.description), thumbnail: r.json.thumbnail, duration: r.json.duration, views: r.json.views, date: r.json.date };
    lastErr = new Error(`ytmp3pc info gagal (status ${r.status})`);
    if (i < tries - 1) await sleep(800 * (i + 1));
  }
  throw lastErr;
}

export async function siteSearch(query) {
  const r = await reqJson(`${SITE}${API_SEARCH}?query=${encodeURIComponent(query)}`, { headers: { Referer: `${SITE}/` } });
  if (!r.json) throw new Error(`search gagal (status ${r.status})`);
  return { query: r.json.query || query, count: (r.json.items || []).length, items: (r.json.items || []).map((it) => ({ videoId: it.videoId, title: dec(it.title), author: dec(it.author), duration: it.duration, thumbnail: it.thumbnail })) };
}

async function musicAvailable(videoId) {
  const tok = token(videoId);
  const r = await reqJson(`${MUSIC_BASE}/music/available-music?v=${encodeURIComponent(videoId)}&token=${tok}`, { headers: convHeaders({ "Content-Type": "application/json" }) });
  if (!r.json || !r.json.success) throw new Error(`available-music gagal: ${(r.json?.message || r.body || "").slice(0, 120)}`);
  return { tok, data: r.json.data };
}

async function videoAvailable(videoId) {
  const tok = token(videoId);
  const r = await reqJson(`${BUCKET}/video/available-video?v=${encodeURIComponent(videoId)}&token=${tok}`, { headers: convHeaders({ "Content-Type": "application/json" }) });
  if (!r.json || !r.json.success) throw new Error(`available-video gagal: ${(r.json?.message || r.body || "").slice(0, 120)}`);
  return { tok, data: r.json.data };
}

async function preProgress(kind, videoId, quality, tok) {
  const path = kind === "mp4" ? "/video/pre-progress" : "/music/pre-progress";
  const r = await reqJson(`${BUCKET}${path}`, { method: "POST", headers: convHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ video_id: videoId, quality: String(quality), sig: String(tok) }) });
  if (!r.json) throw new Error(`pre-progress gagal (status ${r.status})`);
  return r.json;
}

async function pollProgress(kind, jobId, tok, tries = 90) {
  const path = kind === "mp4" ? "/video/progress" : "/music/progress";
  for (let i = 0; i < tries; i++) {
    const r = await reqJson(`${BUCKET}${path}?job_id=${encodeURIComponent(jobId)}&token=${tok}`, { headers: convHeaders() });
    const j = r.json;
    if (!j) throw new Error(`progress gagal (status ${r.status})`);
    if (j.download_url) return j;
    if (j.success === false || j.status === "error" || j.status === "failed") throw new Error(`convert gagal di worker: ${(j.message || "").slice(0, 160)}`);
    await sleep(1000);
  }
  throw new Error(`progress timeout`);
}

export async function convert(videoId, format = "mp3", quality) {
  const kind = format === "mp4" ? "mp4" : "mp3";
  let tok, qualities;
  if (kind === "mp4") {
    const { tok: t, data } = await videoAvailable(videoId);
    tok = t;
    qualities = (data.detail || []).map((d) => ({ quality: d.quality, label: d.quality_label || `${d.quality}p` }));
  } else {
    const { tok: t, data } = await musicAvailable(videoId);
    tok = t;
    qualities = (data.detail || []).map((d) => ({ quality: d.quality, label: d.quality_label || `${d.quality} kbps` }));
  }
  if (!qualities.length) throw new Error(`tidak ada kualitas ${kind}`);
  const qStr = String(quality || qualities[0].quality);
  if (!qualities.some((x) => String(x.quality) === qStr)) throw new Error(`kualitas ${qStr} tidak tersedia (${qualities.map((x) => x.quality).join(", ")})`);
  const pp = await preProgress(kind, videoId, qStr, tok);
  let dl = pp.download_url, jobId = null;
  if (!dl && pp.data?.job_id) { jobId = pp.data.job_id; dl = (await pollProgress(kind, jobId, tok)).download_url; }
  if (!dl) throw new Error("tidak dapat download_url");
  return { videoId, format: kind, quality: Number(qStr), downloadUrl: dl, headers: convHeaders(), qualities: qualities.map((x) => x.quality) };
}

// Download file convert langsung jadi Buffer (untuk di-stream ke client)
export async function downloadConvert(videoId, format = "mp3", quality) {
  const c = await convert(videoId, format, quality);
  const { buffer, contentType } = await downloadFile(c.downloadUrl, c.headers);
  let info = {};
  try { info = await siteInfo(videoId); } catch {}
  return { ...c, buffer, contentType, title: info.title || videoId, author: info.author || "" };
}

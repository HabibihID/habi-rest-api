const ALLOWED_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com']);
const API_HOST = 'www.tiktok.com';
const DEFAULTS = Object.freeze({ maxPages: 3, maxComments: 150, maxReplies: 50, timeoutMs: 5000, concurrency: 4, fetchImpl: globalThis.fetch });

export class TikTokPresetError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new TikTokPresetError(status, code, message); };

export function validateTikTokUrl(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 2048) fail(400, 'INVALID_INPUT', 'url wajib berupa URL TikTok HTTPS yang valid.');
  let url;
  try { url = new URL(value); } catch { fail(400, 'INVALID_INPUT', 'url bukan URL yang valid.'); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) fail(400, 'INVALID_INPUT', 'url hanya boleh HTTPS TikTok tanpa kredensial atau port non-443.');
  return url;
}
function redirectUrl(response, current) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return null;
  const location = response.headers.get('location');
  if (!location) fail(502, 'UPSTREAM_REDIRECT', 'TikTok mengirim redirect tanpa lokasi.');
  let next;
  try { next = new URL(location, current); } catch { fail(502, 'UPSTREAM_REDIRECT', 'Redirect TikTok tidak valid.'); }
  validateTikTokUrl(next.toString());
  return next;
}
async function requestJson(url, options, cfg) {
  let current = url;
  for (let hop = 0; hop <= cfg.maxRedirects; hop++) {
    let response;
    try {
      response = await cfg.fetchImpl(current, { ...options, redirect: 'manual', signal: AbortSignal.timeout(cfg.timeoutMs) });
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') fail(504, 'UPSTREAM_TIMEOUT', 'TikTok tidak merespons dalam batas waktu.');
      fail(503, 'UPSTREAM_UNAVAILABLE', 'TikTok tidak dapat diakses.');
    }
    const next = redirectUrl(response, current);
    if (next) { if (hop === cfg.maxRedirects) fail(502, 'UPSTREAM_REDIRECT', 'Terlalu banyak redirect TikTok.'); current = next; continue; }
    if (!response.ok) fail(response.status >= 500 ? 503 : 502, 'UPSTREAM_STATUS', `TikTok mengembalikan HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    let text;
    try {
      const reader = response.body?.getReader?.();
      if (!reader) text = await response.text();
      else { const chunks = []; let size = 0; while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > cfg.maxBodyBytes) { await reader.cancel(); fail(502, 'UPSTREAM_BODY_TOO_LARGE', 'Respons TikTok terlalu besar.'); } chunks.push(part.value); } text = Buffer.concat(chunks).toString('utf8'); }
    } catch (e) { if (e instanceof TikTokPresetError) throw e; fail(502, 'UPSTREAM_BODY', 'Respons TikTok tidak dapat dibaca.'); }
    if (!contentType.toLowerCase().includes('json')) fail(502, 'UPSTREAM_INVALID_JSON', 'TikTok tidak mengembalikan JSON.');
    try { return JSON.parse(text); } catch { fail(502, 'UPSTREAM_INVALID_JSON', 'Respons TikTok berisi JSON rusak.'); }
  }
}
async function resolveVideoUrl(url, cfg) {
  let current = url;
  for (let hop = 0; hop <= cfg.maxRedirects; hop++) {
    let response;
    try { response = await cfg.fetchImpl(current, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(cfg.timeoutMs) }); }
    catch (e) { if (e.name === 'TimeoutError' || e.name === 'AbortError') fail(504, 'UPSTREAM_TIMEOUT', 'TikTok tidak merespons dalam batas waktu.'); fail(503, 'UPSTREAM_UNAVAILABLE', 'TikTok tidak dapat diakses.'); }
    const next = redirectUrl(response, current);
    if (!next) return current;
    if (hop === cfg.maxRedirects) fail(502, 'UPSTREAM_REDIRECT', 'Terlalu banyak redirect TikTok.');
    current = next;
  }
}
function videoIdFromUrl(url) {
  const match = url.pathname.match(/\/video\/(\d{1,30})(?:[/?]|$)/);
  return match?.[1] || null;
}
function normalizeText(comment) {
  return [comment?.text, comment?.desc, comment?.content].filter(x => typeof x === 'string').join(' ');
}
function commentId(comment) { return String(comment?.cid ?? comment?.comment_id ?? comment?.id ?? ''); }
function extractLinks(text) {
  const direct = new Set(), candidates = new Set();
  const urls = text.match(/https?:\/\/[^\s<>'"\]\)]+/gi) || [];
  for (let raw of urls) {
    raw = raw.replace(/[.,!?;:]+$/u, '');
    let u; try { u = new URL(raw); } catch { continue; }
    const host = u.hostname.toLowerCase();
    if (host === 'alight.link' || (host === 'alightcreative.com' && /^\/am\/share\//i.test(u.pathname))) direct.add(u.toString());
    else if (host === 'drive.google.com' || host === 'mediafire.com' || host.endsWith('.mediafire.com')) candidates.add(u.toString());
  }
  return { direct, candidates };
}
function statusCode(data) { return data && Number(data.status_code ?? 0); }
function pageItems(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.comments)) fail(502, 'UPSTREAM_INVALID_JSON', 'Respons TikTok tidak memiliki comments[].');
  if (statusCode(data) !== 0) fail(502, 'UPSTREAM_STATUS', `TikTok mengembalikan status_code ${data.status_code}.`);
  return data.comments;
}
async function mapLimit(items, limit, fn) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) await fn(items[cursor++]); }));
}

export async function getTikTokAmPreset(input, options = {}) {
  const cfg = { ...DEFAULTS, ...options, maxRedirects: options.maxRedirects ?? 4, maxBodyBytes: options.maxBodyBytes ?? 1_500_000 };
  for (const [name, min, max] of [['maxPages',1,10],['maxComments',1,500],['maxReplies',0,500],['timeoutMs',1,10000],['concurrency',1,8],['maxRedirects',0,5],['maxBodyBytes',1,3000000]]) {
    if (!Number.isInteger(cfg[name]) || cfg[name] < min || cfg[name] > max) fail(400, 'INVALID_OPTIONS', `${name} wajib bilangan bulat ${min}–${max}.`);
  }
  if (typeof cfg.fetchImpl !== 'function') fail(500, 'CONFIGURATION_ERROR', 'Fetch implementation tidak tersedia.');
  const fetchImpl = cfg.fetchImpl, deadline = AbortSignal.timeout(15000);
  let requestCount = 0;
  cfg.fetchImpl = (url, init) => {
    if (++requestCount > 40) fail(503, 'REQUEST_LIMIT', 'Batas 40 permintaan TikTok tercapai.');
    return fetchImpl(url, { ...init, signal: AbortSignal.any([deadline, init.signal]) });
  };
  const initial = validateTikTokUrl(input?.url);
  const follow = input?.followReplies !== false;
  let resolved = initial;
  let videoId = videoIdFromUrl(resolved);
  if (!videoId) {
    resolved = await resolveVideoUrl(resolved, cfg);
    videoId = videoIdFromUrl(resolved);
    if (!videoId) fail(400, 'INVALID_INPUT', 'URL TikTok tidak memuat video_id dan tidak dapat diarahkan ke URL video.');
  }
  // API requests are built from the validated numeric ID; discovered links are never fetched.
  const comments = [], seenComment = new Set(); let cursor = '0'; let pages = 0; let complete = false;
  const direct = new Set(), candidates = new Set(); let repliesScanned = 0;
  while (pages < cfg.maxPages && comments.length < cfg.maxComments) {
    const endpoint = new URL(`https://${API_HOST}/api/comment/list/`);
    endpoint.search = new URLSearchParams({ aid: '1988', aweme_id: videoId, count: '50', cursor }).toString();
    const data = await requestJson(endpoint, { headers: { 'user-agent': 'Mozilla/5.0', referer: resolved.toString(), accept: 'application/json' } }, cfg);
    const items = pageItems(data);
    for (const comment of items) {
      const id = commentId(comment); if (id && seenComment.has(id)) continue;
      if (id) seenComment.add(id); comments.push(comment); const found = extractLinks(normalizeText(comment));
      found.direct.forEach(x => direct.add(x)); found.candidates.forEach(x => candidates.add(x));
      if (comments.length >= cfg.maxComments) break;
    }
    pages++;
    const hasMore = Boolean(data.has_more); const next = String(data.cursor ?? '');
    if (!hasMore || !next || next === cursor || comments.length >= cfg.maxComments) { complete = !hasMore; break; }
    cursor = next;
  }
  const parents = comments.filter(c => commentId(c) && Number(c.reply_comment_total ?? c.replyCount ?? 0) > 0);
  let repliesComplete = follow || parents.length === 0;
  // Sequential pagination keeps the shared reply budget exact and avoids overshoot.
  if (follow) for (const comment of parents) {
    let replyCursor = '0', threadComplete = false;
    for (let page = 0; page < cfg.maxPages && repliesScanned < cfg.maxReplies; page++) {
      const endpoint = new URL(`https://${API_HOST}/api/comment/list/reply/`);
      endpoint.search = new URLSearchParams({ aid: '1988', item_id: videoId, comment_id: commentId(comment), count: '50', cursor: replyCursor }).toString();
      const data = await requestJson(endpoint, { headers: { 'user-agent': 'Mozilla/5.0', referer: resolved.toString(), accept: 'application/json' } }, cfg);
      const items = pageItems(data);
      const selected = items.slice(0, cfg.maxReplies - repliesScanned);
      for (const reply of selected) { repliesScanned++; const found = extractLinks(normalizeText(reply)); found.direct.forEach(x => direct.add(x)); found.candidates.forEach(x => candidates.add(x)); }
      const hasMore = Boolean(data.has_more), next = String(data.cursor ?? '');
      if (!hasMore) { threadComplete = selected.length === items.length; break; }
      if (!next || next === replyCursor) break;
      replyCursor = next;
    }
    if (!threadComplete) repliesComplete = false;
  }
  complete = complete && repliesComplete;
  return { videoId, links: [...direct].map(url => ({ url, type: 'alight-motion', verified: false, confidence: 'direct' })), candidates: [...candidates].map(url => ({ url, type: 'candidate', verified: false })), commentsScanned: comments.length, repliesScanned, pagination: { pages, complete, truncated: !complete, maxPages: cfg.maxPages, maxComments: cfg.maxComments } };
}
export const createTikTokAmPreset = options => input => getTikTokAmPreset(input, options);

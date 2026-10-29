// DuckDuckGo search — parse endpoint HTML publik DDG (html.duckduckgo.com),
// fallback lite.duckduckgo.com. Tanpa API key. Bila DDG menyajikan CAPTCHA/
// anomaly, dilempar sebagai error jujur (tidak di-bypass).
// Dari kode kiriman user 2026-10-21 (ESM, cheerio utk parsing).
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function unwrapDdg(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com')
    const real = u.searchParams.get('uddg')
    return real ? decodeURIComponent(real) : u.href
  } catch {
    return href
  }
}

function looksBlocked(html, status) {
  return status === 202 || /anomaly|captcha|bots use DuckDuckGo/i.test(html.slice(0, 8000)) && /anomaly-modal|g-recaptcha|challenge/i.test(html)
}

async function fetchDdgHtml(q, region) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}${region ? `&kl=${encodeURIComponent(region)}` : ''}`
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) })
  const html = await r.text()
  if (looksBlocked(html, r.status)) throw new Error('DuckDuckGo menyajikan CAPTCHA/anomaly dari IP server — coba lagi nanti')
  if (!r.ok) throw new Error(`DDG html HTTP ${r.status}`)
  return html
}

function parseHtmlResults(html, max) {
  const $ = cheerio.load(html)
  const out = []
  $('.result').each((_, el) => {
    const a = $(el).find('a.result__a').first()
    const title = a.text().trim()
    const href = a.attr('href') || ''
    const snippet = $(el).find('.result__snippet').first().text().trim()
    if (title && href) out.push({ title, url: unwrapDdg(href), snippet })
  })
  return out.slice(0, max)
}

async function fetchDdgLite(q) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) })
  const html = await r.text()
  if (looksBlocked(html, r.status)) throw new Error('DuckDuckGo menyajikan CAPTCHA/anomaly dari IP server — coba lagi nanti')
  if (!r.ok) throw new Error(`DDG lite HTTP ${r.status}`)
  return html
}

function parseLiteResults(html, max) {
  const $ = cheerio.load(html)
  const out = []
  $('a.result-link').each((_, el) => {
    const a = $(el)
    const title = a.text().trim()
    const href = a.attr('href') || ''
    const snippet = a.closest('tr').next('tr').find('.result-snippet').first().text().trim()
    if (title && href) out.push({ title, url: unwrapDdg(href), snippet })
  })
  return out.slice(0, max)
}

export async function ddgSearch(q, { max = 5, region = '' } = {}) {
  const limit = Math.min(Math.max(parseInt(max) || 5, 1), 10)
  let results = []
  let engine = 'html'
  try {
    results = parseHtmlResults(await fetchDdgHtml(q, region), limit)
  } catch (e) {
    if (/CAPTCHA/.test(e.message)) throw e
    results = []
  }
  if (!results.length) {
    engine = 'lite'
    results = parseLiteResults(await fetchDdgLite(q), limit)
  }
  if (!results.length) throw new Error('Tidak ada hasil dari DuckDuckGo')
  return { query: q, engine, count: results.length, results }
}

export default { ddgSearch }

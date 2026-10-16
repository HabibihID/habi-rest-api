// bioskop — Scrape jadwal bioskop dari jadwalnonton.com (tanpa anti-bot, akses publik).
// Cover seluruh Indonesia: /bioskop/di-{kota}/

import * as cheerio from 'cheerio'

const BASE = 'https://jadwalnonton.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function getHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`jadwalnonton.com HTTP ${r.status}`)
  return r.text()
}

const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')

// Daftar bioskop di satu kota
export async function listTheaters(kota) {
  const slug = slugify(kota)
  const html = await getHtml(`${BASE}/bioskop/di-${slug}/`)
  const $ = cheerio.load(html)
  const out = []
  // Link "LIHAT JADWAL DAN HARGA TIKET" mengarah ke halaman tiap bioskop
  $('a').each((_, el) => {
    const t = $(el).text().trim()
    const href = $(el).attr('href') || ''
    if (/lihat jadwal/i.test(t) && href.includes('/bioskop/')) {
      // Nama bioskop dari elemen sebelumnya (heading/gambar alt)
      const card = $(el).closest('div')
      const name = card.find('img').attr('alt')?.replace(/^Bioskop\s+/i, '') || card.text().split('\n')[0]?.trim() || ''
      const url = href.startsWith('http') ? href : BASE + href
      if (name && !out.find(x => x.url === url)) out.push({ name: name.trim(), url })
    }
  })
  return out
}

// Jadwal film di satu bioskop (dari URL halaman bioskop)
export async function getSchedule(theaterUrl) {
  const html = await getHtml(theaterUrl)
  const $ = cheerio.load(html)
  const movies = []
  // Tiap film dalam <div class="item">: judul di h2/h3, format di .showgroup, harga di .htm, jam di ul.usch > li
  $('div.item').each((_, item) => {
    const $it = $(item)
    const titleRaw = $it.find('h2, h3').first().text().trim()
    if (!titleRaw) return
    const m = titleRaw.match(/^(.+?)(\d+\+)?$/)
    const title = (m?.[1] || titleRaw).trim()
    const schedules = []
    // Tiap grup format: span.showgroup + span.htm + ul.usch
    $it.find('span.showgroup').each((_, sg) => {
      const format = $(sg).text().trim()
      const htm = $(sg).nextAll('span.htm').first().text()
      const price = (htm.match(/Rp\s*([\d.,]+)/) || [])[1] || ''
      const times = []
      $(sg).nextAll('ul.usch').first().find('li').each((_, li) => {
        const t = $(li).text().trim()
        if (/^\d{1,2}:\d{2}$/.test(t)) times.push(t)
      })
      if (format) schedules.push({ format, price, times })
    })
    if (title && schedules.length) movies.push({ title, rating: m?.[2] || '', schedules })
  })
  const name = $('h1').first().text().replace(/Jadwal Bioskop|\+ Harga Tiket Hari Ini/gi, '').trim()
  return { name, movies: movies.slice(0, 20) }
}

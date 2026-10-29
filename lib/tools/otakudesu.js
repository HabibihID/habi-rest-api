// Otakudesu — katalog & episode anime untuk HABI REST API.
// Di-port dari otakudesu.mjs kiriman user 2026-10-21 (scrape otakudesu.blog).
/**
 * otakudesu.mjs — Unofficial Otakudesu Scraper (ESM, single file)
 * Target : https://otakudesu.blog
 * Mode   : CLI + Module
 *
 * Dependencies (install once):
 *   npm i cheerio
 *
 * Usage (CLI):
 *   node otakudesu.mjs home
 *   node otakudesu.mjs ongoing [page]
 *   node otakudesu.mjs complete [page]
 *   node otakudesu.mjs search "naruto"
 *   node otakudesu.mjs anime <slug>
 *   node otakudesu.mjs episode <episode-slug>
 *   node otakudesu.mjs batch <batch-slug>
 *   node otakudesu.mjs schedule
 *   node otakudesu.mjs genres
 *   node otakudesu.mjs genre <genre-slug> [page]
 *   node otakudesu.mjs anime-list
 *
 * Usage (Module):
 *   import Otakudesu from './otakudesu.mjs'
 *   const o = new Otakudesu()
 *   const data = await o.home()
 */

import * as cheerio from 'cheerio'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const __filename = fileURLToPath(import.meta.url)
const isCLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)

const DEFAULT_BASE = 'https://otakudesu.blog'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** @typedef {{ title: string, slug: string, url: string, episode?: string, day?: string, date?: string, thumb?: string, score?: string, episodes?: string, genres?: string, status?: string }} AnimeCard */
/** @typedef {{ title: string, japanese?: string, score?: string, producer?: string, type?: string, status?: string, totalEpisodes?: string, duration?: string, releaseDate?: string, studio?: string, genres?: string[], synopsis?: string, thumb?: string, slug: string, url: string, episodes: { title: string, slug: string, url: string, date?: string }[], batch?: { title: string, slug: string, url: string } | null }} AnimeDetail */
/** @typedef {{ title: string, slug: string, url: string, stream?: string, downloads?: Record<string, { quality: string, links: { host: string, url: string }[] }[]>, prev?: { title: string, slug: string, url: string } | null, next?: { title: string, slug: string, url: string } | null }} EpisodeDetail */

class Otakudesu {
  /**
   * @param {object} [opts]
   * @param {string} [opts.baseUrl]
   * @param {string} [opts.userAgent]
   * @param {number} [opts.timeout]
   * @param {Record<string,string>} [opts.headers]
   */
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || process.env.OTAKUDESU_URL || DEFAULT_BASE).replace(/\/+$/, '')
    this.userAgent = opts.userAgent || USER_AGENT
    this.timeout = opts.timeout || 30000
    this.extraHeaders = opts.headers || {}
  }

  /** @private */
  async request(pathname) {
    const url = pathname.startsWith('http') ? pathname : `${this.baseUrl}${pathname.startsWith('/') ? '' : '/'}${pathname}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: this.baseUrl + '/',
          ...this.extraHeaders,
        },
        redirect: 'follow',
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} → ${url}`)
      }

      const html = await res.text()

      // Deteksi Cloudflare / captcha
      if (
        html.includes('cf-error-details') ||
        html.includes('Attention Required') ||
        html.includes('Just a moment') ||
        html.includes('cf-challenge')
      ) {
        throw new Error(
          'Cloudflare challenge terdeteksi. Coba ganti baseUrl / gunakan proxy / header lebih lengkap.'
        )
      }

      return cheerio.load(html)
    } finally {
      clearTimeout(timer)
    }
  }

  /** @private */
  slugFromUrl(href = '') {
    if (!href) return ''
    try {
      const u = new URL(href, this.baseUrl)
      const parts = u.pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || parts[parts.length - 2] || ''
    } catch {
      return href.replace(/\/+$/, '').split('/').pop() || ''
    }
  }

  /** @private */
  abs(href = '') {
    if (!href) return ''
    try {
      return new URL(href, this.baseUrl).href
    } catch {
      return href
    }
  }

  /** @private */
  text($el) {
    return ($el?.text() || '').replace(/\s+/g, ' ').trim()
  }

  /**
   * Parse satu kartu anime dari elemen .detpost
   * Struktur tipikal:
   *   .detpost > .thumb > a > img
   *   .detpost > h2 / .jdlrx / .thumbz  → judul
   *   .detpost > .epz                   → "Episode N"
   *   .detpost > .epztipe               → hari (Senin/…) ATAU skor (7.5)
   *   .detpost > .newnime               → tanggal
   * @private
   * @returns {AnimeCard | null}
   */
  parseCard($el) {
    const a =
      $el.find('a[href*="/anime/"]').first().length
        ? $el.find('a[href*="/anime/"]').first()
        : $el.find('a').first()
    const href = a.attr('href') || ''
    if (!href.includes('/anime/')) return null

    // Judul: prioritaskan elemen judul, JANGAN pakai .epz / .epztipe
    let title =
      this.text(
        $el.find('.jdlrx a, .jdlrx, .jdl a, .jdl, .thumbz h2 a, .thumbz h2, h2 a, h2').first()
      ) ||
      a.attr('title') ||
      this.text(a)
    title = title.replace(/\s+/g, ' ').trim()
    // Bersihkan prefix hari yang kadang nempel (mis. "SeninJudul")
    title = title
      .replace(
        /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
        ''
      )
      .trim()
    if (!title || title.length < 2) return null

    const thumb = $el.find('img').attr('src') || $el.find('img').attr('data-src') || ''
    const epz = this.text($el.find('.epz').first())
    const epztipe = this.text($el.find('.epztipe').first())
    const date = this.text($el.find('.newnime, .date').first())

    const isDay =
      /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Random|None)$/i.test(
        epztipe
      )
    const isScore = /^\d+(\.\d+)?$/.test(epztipe)

    /** @type {AnimeCard} */
    const card = {
      title,
      slug: this.slugFromUrl(href),
      url: this.abs(href),
      thumb: this.abs(thumb) || undefined,
      date: date || undefined,
    }

    if (epz) {
      const m = epz.match(/Episode\s*\d+/i) || epz.match(/\d+\s*Episode/i)
      card.episode = m
        ? m[0]
        : epz.replace(/\s*(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s*/gi, '').trim() ||
          undefined
    }
    if (isDay) card.day = epztipe
    else if (isScore) card.score = epztipe
    else if (epztipe) card.score = epztipe

    return card
  }

  /** Dedup array of cards by slug, prefer entry that has more fields */
  /** @private */
  dedupCards(cards) {
    const map = new Map()
    for (const c of cards) {
      if (!c?.slug) continue
      const prev = map.get(c.slug)
      if (!prev) {
        map.set(c.slug, c)
        continue
      }
      // Prefer the one with episode / day / score
      const score = (x) =>
        (x.episode ? 2 : 0) + (x.day ? 1 : 0) + (x.score ? 1 : 0) + (x.date ? 1 : 0)
      if (score(c) > score(prev)) map.set(c.slug, c)
    }
    return [...map.values()]
  }

  /** @private */
  parseInfoTable($, root) {
    const info = {}
    // Format klasik otakudesu: span / b / p dengan label
    $(root)
      .find('p, span, div.infozingle p, .infozingle p, .anim-content p')
      .each((_, el) => {
        const t = this.text($(el))
        if (!t.includes(':')) return
        const [key, ...rest] = t.split(':')
        const val = rest.join(':').trim()
        const k = key.trim().toLowerCase()
        if (k.includes('judul')) info.title = val
        else if (k.includes('japanese') || k.includes('jepang')) info.japanese = val
        else if (k.includes('skor') || k.includes('score')) info.score = val
        else if (k.includes('produser') || k.includes('producer')) info.producer = val
        else if (k.includes('tipe') || k.includes('type')) info.type = val
        else if (k.includes('status')) info.status = val
        else if (k.includes('total episode') || k.includes('episodes')) info.totalEpisodes = val
        else if (k.includes('durasi') || k.includes('duration')) info.duration = val
        else if (k.includes('tanggal rilis') || k.includes('release')) info.releaseDate = val
        else if (k.includes('studio')) info.studio = val
        else if (k.includes('genre')) {
          info.genres = val
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean)
        }
      })

    // Fallback: label + value terpisah
    $(root)
      .find('.infozingle span, .infozingle b, .venser span')
      .each((_, el) => {
        const t = this.text($(el))
        if (t.endsWith(':')) {
          const key = t.slice(0, -1).trim().toLowerCase()
          const val = this.text($(el).next())
          if (!val) return
          if (key.includes('judul') && !info.title) info.title = val
          if ((key.includes('japanese') || key.includes('jepang')) && !info.japanese) info.japanese = val
          if ((key.includes('skor') || key.includes('score')) && !info.score) info.score = val
          if ((key.includes('produser') || key.includes('producer')) && !info.producer) info.producer = val
          if ((key.includes('tipe') || key.includes('type')) && !info.type) info.type = val
          if (key.includes('status') && !info.status) info.status = val
          if ((key.includes('total episode') || key.includes('episodes')) && !info.totalEpisodes)
            info.totalEpisodes = val
          if ((key.includes('durasi') || key.includes('duration')) && !info.duration) info.duration = val
          if ((key.includes('tanggal rilis') || key.includes('release')) && !info.releaseDate)
            info.releaseDate = val
          if (key.includes('studio') && !info.studio) info.studio = val
          if (key.includes('genre') && !info.genres) {
            info.genres = val
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean)
          }
        }
      })

    return info
  }

  // ───────────────────────── HOME ─────────────────────────

  /** @returns {Promise<{ ongoing: AnimeCard[], complete: AnimeCard[] }>} */
  async home() {
    const $ = await this.request('/')
    /** @type {AnimeCard[]} */
    const ongoingRaw = []
    /** @type {AnimeCard[]} */
    const completeRaw = []

    // Hanya ambil .detpost (bukan .thumb yang nested di dalamnya → penyebab duplikat)
    // Section ongoing biasanya di .venz / .rseries pertama
    $('.venz .detpost, .rseries .detpost, #venkonten .detpost, .ongoing .detpost').each((_, el) => {
      const card = this.parseCard($(el))
      if (!card) return
      // Di homepage, kartu yang punya day biasanya ongoing
      if (card.day || card.episode) ongoingRaw.push(card)
      else completeRaw.push(card)
    })

    // Section complete eksplisit (kalau ada class berbeda)
    $('.complete .detpost, .komplet .detpost').each((_, el) => {
      const card = this.parseCard($(el))
      if (card) completeRaw.push(card)
    })

    let ongoing = this.dedupCards(ongoingRaw)
    let complete = this.dedupCards(completeRaw).filter(
      (c) => !ongoing.some((o) => o.slug === c.slug)
    )

    // Fallback longgar
    if (ongoing.length === 0 && complete.length === 0) {
      const seen = new Set()
      $('a[href*="/anime/"]').each((_, el) => {
        const href = $(el).attr('href') || ''
        let title = this.text($(el)) || $(el).attr('title') || ''
        title = title.replace(/\s+/g, ' ').trim()
        if (!title || title.length < 3) return
        const slug = this.slugFromUrl(href)
        if (seen.has(slug)) return
        seen.add(slug)
        ongoing.push({ title, slug, url: this.abs(href) })
      })
    }

    return { ongoing, complete }
  }

  // ───────────────────────── ONGOING / COMPLETE ─────────────────────────

  /** @param {number} [page=1] */
  async ongoing(page = 1) {
    const path = page > 1 ? `/ongoing-anime/page/${page}/` : '/ongoing-anime/'
    return this._listPage(path)
  }

  /** @param {number} [page=1] */
  async complete(page = 1) {
    const path = page > 1 ? `/complete-anime/page/${page}/` : '/complete-anime/'
    return this._listPage(path)
  }

  /** @private */
  async _listPage(pathname) {
    const $ = await this.request(pathname)
    /** @type {AnimeCard[]} */
    const raw = []

    // Hanya .detpost — jangan .thumb (nested → duplikat)
    $('.venz .detpost, .detpost').each((_, el) => {
      const card = this.parseCard($(el))
      if (card) raw.push(card)
    })

    const list = this.dedupCards(raw)

    // Pagination info
    let maxPage = 1
    $('.pagination a, .page-numbers a, .wp-pagenavi a').each((_, el) => {
      const n = parseInt(this.text($(el)), 10)
      if (!isNaN(n) && n > maxPage) maxPage = n
    })

    const pageMatch = pathname.match(/page\/(\d+)/)
    return {
      list,
      page: pageMatch ? Number(pageMatch[1]) : 1,
      maxPage,
    }
  }

  // ───────────────────────── SEARCH ─────────────────────────

  /** @param {string} query */
  async search(query) {
    if (!query?.trim()) throw new Error('Query pencarian kosong')
    const q = encodeURIComponent(query.trim())
    const $ = await this.request(`/?s=${q}&post_type=anime`)
    /** @type {AnimeCard[]} */
    const raw = []

    // .detpost / hasil pencarian klasik otakudesu (.chivsrc li)
    $('.venz .detpost, .detpost, .chivsrc li, .searchx').each((_, el) => {
      const $el = $(el)
      // Coba parseCard dulu (untuk struktur .detpost)
      const card = this.parseCard($el)
      if (card) {
        // Tambah meta search jika ada
        const genres = this.text($el.find('.set').filter((_, e) => /genre/i.test($(e).text())).first())
          .replace(/^genres?\s*:?\s*/i, '')
        const status = this.text($el.find('.set').filter((_, e) => /status/i.test($(e).text())).first())
          .replace(/^status\s*:?\s*/i, '')
        const rating = this.text($el.find('.set').filter((_, e) => /rating|skor|score/i.test($(e).text())).first())
          .replace(/^(rating|skor|score)\s*:?\s*/i, '')
        if (genres) card.genres = genres
        if (status) card.status = status
        if (rating && !card.score) card.score = rating
        raw.push(card)
        return
      }

      // Fallback struktur .chivsrc li (search hasil lama)
      const a = $el.find('a[href*="/anime/"]').first()
      const href = a.attr('href') || ''
      if (!href.includes('/anime/')) return
      let title = this.text(a) || a.attr('title') || ''
      title = title.replace(/\s+/g, ' ').trim()
      // Hindari judul dobel (kadang text + title attribute digabung)
      if (title.length > 10) {
        const half = Math.floor(title.length / 2)
        if (title.slice(0, half) === title.slice(half)) title = title.slice(0, half)
      }
      if (!title || title.length < 2) return
      const thumb = $el.find('img').attr('src') || $el.find('img').attr('data-src') || ''
      raw.push({
        title,
        slug: this.slugFromUrl(href),
        url: this.abs(href),
        thumb: this.abs(thumb) || undefined,
      })
    })

    let list = this.dedupCards(raw)

    // Fallback terakhir
    if (list.length === 0) {
      const seen = new Set()
      $('a[href*="/anime/"]').each((_, el) => {
        const href = $(el).attr('href') || ''
        let title = this.text($(el)) || $(el).attr('title') || ''
        title = title.replace(/\s+/g, ' ').trim()
        if (title.length < 3) return
        const slug = this.slugFromUrl(href)
        if (seen.has(slug)) return
        seen.add(slug)
        list.push({ title, slug, url: this.abs(href) })
      })
    }

    return list
  }

  // ───────────────────────── ANIME DETAIL ─────────────────────────

  /**
   * @param {string} slug  contoh: sayonara-lara-sub-indo
   * @returns {Promise<AnimeDetail>}
   */
  async anime(slug) {
    if (!slug) throw new Error('Slug anime diperlukan')
    const clean = slug.replace(/^\/+|\/+$/g, '').replace(/^anime\//, '')
    const $ = await this.request(`/anime/${clean}/`)

    const title =
      this.text($('.jdlrx h1, .jdlrx, h1.entry-title, .anime-title, #venkonten h1')) ||
      this.text($('h1'))
    const thumb =
      $('.fotoanime img, .thumb img, .anime-poster img, .foto img').attr('src') ||
      $('.fotoanime img, .thumb img').attr('data-src') ||
      ''

    const info = this.parseInfoTable($, '#venkonten, .venser, .anime-info, .infozingle, body')

    // Synopsis
    let synopsis = ''
    $('.sinopc, .sinopsis, .synopsis, .entry-content p').each((_, el) => {
      const t = this.text($(el))
      if (t.length > 40 && !t.includes('Judul') && !t.includes('Japanese')) {
        synopsis += (synopsis ? ' ' : '') + t
      }
    })
    if (!synopsis) {
      synopsis = this.text($('.sinopc, .sinopsis, .synopsis'))
    }

    // Episode list
    /** @type {{ title: string, slug: string, url: string, date?: string }[]} */
    const episodes = []
    $('.episodelist ul li, .episode-list li, .listeps li, #venkonten ul li, .venser ul li').each(
      (_, el) => {
        const $el = $(el)
        const a = $el.find('a').first()
        const href = a.attr('href') || ''
        if (!href.includes('/episode/')) return
        const epTitle = this.text(a) || a.attr('title') || ''
        const date = this.text($el.find('.zee, .date, span').last()) || this.text($el).replace(epTitle, '').trim()
        episodes.push({
          title: epTitle.trim(),
          slug: this.slugFromUrl(href),
          url: this.abs(href),
          date: date || undefined,
        })
      }
    )

    // Batch link
    let batch = null
    $('a[href*="/batch/"], a[href*="batch"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href.includes('/batch/')) return
      batch = {
        title: this.text($(el)) || 'Batch',
        slug: this.slugFromUrl(href),
        url: this.abs(href),
      }
    })

    return {
      title: info.title || title,
      japanese: info.japanese,
      score: info.score,
      producer: info.producer,
      type: info.type,
      status: info.status,
      totalEpisodes: info.totalEpisodes,
      duration: info.duration,
      releaseDate: info.releaseDate,
      studio: info.studio,
      genres: info.genres || [],
      synopsis: synopsis || undefined,
      thumb: this.abs(thumb) || undefined,
      slug: clean,
      url: `${this.baseUrl}/anime/${clean}/`,
      episodes,
      batch,
    }
  }

  // ───────────────────────── EPISODE DETAIL ─────────────────────────

  /**
   * @param {string} episodeSlug  contoh: syla-episode-9-sub-indo
   * @returns {Promise<EpisodeDetail>}
   */
  async episode(episodeSlug) {
    if (!episodeSlug) throw new Error('Slug episode diperlukan')
    const clean = episodeSlug.replace(/^\/+|\/+$/g, '').replace(/^episode\//, '')
    const $ = await this.request(`/episode/${clean}/`)

    const title =
      this.text($('.jdlrx h1, .jdlrx, h1.entry-title, #venkonten h1, .episode-title')) ||
      this.text($('h1'))

    // Stream (iframe / embed)
    let stream = ''
    $('iframe, embed, video source, #pembed iframe, .player iframe, .responsive-embed iframe').each(
      (_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || ''
        if (src && !stream) stream = this.abs(src)
      }
    )
    // Kadang ada mirror list
    if (!stream) {
      $('a[href*="player"], a[data-content], .mirror a').each((_, el) => {
        const href = $(el).attr('href') || $(el).attr('data-content') || ''
        if (href.startsWith('http') && !stream) stream = href
      })
    }

    // Download links per kualitas
    /** @type {Record<string, { quality: string, links: { host: string, url: string }[] }[]>} */
    const downloads = {}
    $('.download, .dl, .download-link, .soraurlx, .mirror, #venkonten .download').each((_, section) => {
      const $sec = $(section)
      $sec.find('ul li, .res, .quality, p, h4, strong').each((__, el) => {
        const $el = $(el)
        const qualityText = this.text($el.find('strong, b, .res').first()) || this.text($el)
        const qualityMatch = qualityText.match(/(\d{3,4}p|MKV|MP4|360|480|720|1080)/i)
        const quality = qualityMatch ? qualityMatch[0] : qualityText.slice(0, 20) || 'unknown'

        const links = []
        $el.find('a').each((___, a) => {
          const href = $(a).attr('href') || ''
          if (!href || href === '#' || href.startsWith('javascript')) return
          links.push({
            host: this.text($(a)) || new URL(this.abs(href)).hostname,
            url: this.abs(href),
          })
        })

        // Juga cek sibling links
        $el.nextUntil('h4, strong, .res').find('a').each((___, a) => {
          const href = $(a).attr('href') || ''
          if (!href || href === '#') return
          links.push({
            host: this.text($(a)) || new URL(this.abs(href)).hostname,
            url: this.abs(href),
          })
        })

        if (links.length) {
          if (!downloads[quality]) downloads[quality] = []
          downloads[quality].push({ quality, links })
        }
      })
    })

    // Fallback download: semua link di area download
    if (Object.keys(downloads).length === 0) {
      const allLinks = []
      $('.download a, .dl a, a[href*="drive.google"], a[href*="mediafire"], a[href*="zippyshare"], a[href*="mega"]').each(
        (_, a) => {
          const href = $(a).attr('href') || ''
          if (!href || href === '#') return
          allLinks.push({
            host: this.text($(a)) || new URL(this.abs(href)).hostname,
            url: this.abs(href),
          })
        }
      )
      if (allLinks.length) downloads['default'] = [{ quality: 'default', links: allLinks }]
    }

    // Prev / Next
    let prev = null
    let next = null
    $('a[rel="prev"], a.prev, .prev a, a:contains("Previous"), a:contains("Sebelumnya")').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href.includes('/episode/')) {
        prev = {
          title: this.text($(el)) || 'Previous',
          slug: this.slugFromUrl(href),
          url: this.abs(href),
        }
      }
    })
    $('a[rel="next"], a.next, .next a, a:contains("Next"), a:contains("Selanjutnya")').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href.includes('/episode/')) {
        next = {
          title: this.text($(el)) || 'Next',
          slug: this.slugFromUrl(href),
          url: this.abs(href),
        }
      }
    })

    return {
      title,
      slug: clean,
      url: `${this.baseUrl}/episode/${clean}/`,
      stream: stream || undefined,
      downloads,
      prev,
      next,
    }
  }

  // ───────────────────────── BATCH ─────────────────────────

  /** @param {string} batchSlug */
  async batch(batchSlug) {
    if (!batchSlug) throw new Error('Slug batch diperlukan')
    const clean = batchSlug.replace(/^\/+|\/+$/g, '').replace(/^batch\//, '')
    const $ = await this.request(`/batch/${clean}/`)

    const title =
      this.text($('.jdlrx h1, .jdlrx, h1.entry-title, #venkonten h1')) || this.text($('h1'))

    /** @type {Record<string, { quality: string, links: { host: string, url: string }[] }[]>} */
    const downloads = {}
    $('.download, .dl, .soraurlx, #venkonten .download').each((_, section) => {
      const $sec = $(section)
      $sec.find('ul li, p, h4, strong, .res').each((__, el) => {
        const $el = $(el)
        const qualityText = this.text($el.find('strong, b').first()) || this.text($el)
        const qualityMatch = qualityText.match(/(\d{3,4}p|MKV|MP4|360|480|720|1080)/i)
        const quality = qualityMatch ? qualityMatch[0] : 'batch'

        const links = []
        $el.find('a').each((___, a) => {
          const href = $(a).attr('href') || ''
          if (!href || href === '#') return
          links.push({
            host: this.text($(a)) || new URL(this.abs(href)).hostname,
            url: this.abs(href),
          })
        })
        if (links.length) {
          if (!downloads[quality]) downloads[quality] = []
          downloads[quality].push({ quality, links })
        }
      })
    })

    return {
      title,
      slug: clean,
      url: `${this.baseUrl}/batch/${clean}/`,
      downloads,
    }
  }

  // ───────────────────────── SCHEDULE ─────────────────────────

  async schedule() {
    const $ = await this.request('/jadwal-rilis/')
    /** @type {Record<string, AnimeCard[]>} */
    const schedule = {}

    $('.kglist321, .schedule, .hari, .day-list, .venz').each((_, section) => {
      const $sec = $(section)
      let day = this.text($sec.find('h2, h3, .day, .hari').first()) || 'Unknown'
      day = day.replace(/jadwal|rilis|anime/gi, '').trim() || 'Unknown'

      if (!schedule[day]) schedule[day] = []

      $sec.find('a[href*="/anime/"], li a, .detpost a').each((__, a) => {
        const href = $(a).attr('href') || ''
        if (!href.includes('/anime/')) return
        const title = this.text($(a)) || $(a).attr('title') || ''
        if (!title) return
        schedule[day].push({
          title: title.trim(),
          slug: this.slugFromUrl(href),
          url: this.abs(href),
        })
      })
    })

    // Fallback struktur lain
    if (Object.keys(schedule).length === 0) {
      $('h2, h3').each((_, h) => {
        const day = this.text($(h))
        if (!/senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday/i.test(day)) return
        const list = []
        $(h)
          .nextUntil('h2, h3')
          .find('a[href*="/anime/"]')
          .each((__, a) => {
            const href = $(a).attr('href') || ''
            list.push({
              title: this.text($(a)).trim(),
              slug: this.slugFromUrl(href),
              url: this.abs(href),
            })
          })
        if (list.length) schedule[day] = list
      })
    }

    return schedule
  }

  // ───────────────────────── GENRES ─────────────────────────

  async genres() {
    const $ = await this.request('/genre-list/')
    /** @type {{ name: string, slug: string, url: string }[]} */
    const list = []

    $('a[href*="/genres/"], .genres a, .genre-list a, ul li a').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href.includes('/genres/') && !href.includes('/genre/')) return
      const name = this.text($(el))
      if (!name) return
      list.push({
        name: name.trim(),
        slug: this.slugFromUrl(href),
        url: this.abs(href),
      })
    })

    // Dedup
    const seen = new Set()
    return list.filter((g) => {
      if (seen.has(g.slug)) return false
      seen.add(g.slug)
      return true
    })
  }

  /**
   * @param {string} genreSlug
   * @param {number} [page=1]
   */
  async genre(genreSlug, page = 1) {
    if (!genreSlug) throw new Error('Slug genre diperlukan')
    const clean = genreSlug.replace(/^\/+|\/+$/g, '')
    const path =
      page > 1 ? `/genres/${clean}/page/${page}/` : `/genres/${clean}/`
    return this._listPage(path)
  }

  // ───────────────────────── ANIME LIST (A-Z) ─────────────────────────

  async animeList() {
    const $ = await this.request('/anime-list/')
    /** @type {{ letter: string, items: { title: string, slug: string, url: string }[] }[]} */
    const groups = []

    $('.hodebgst, .daftarkartun, .anime-list, #venkonten').each((_, section) => {
      const $sec = $(section)
      $sec.find('h2, h3, .baris, .letter').each((__, h) => {
        const letter = this.text($(h)).slice(0, 5)
        const items = []
        $(h)
          .nextUntil('h2, h3, .baris')
          .find('a[href*="/anime/"]')
          .each((___, a) => {
            const href = $(a).attr('href') || ''
            items.push({
              title: this.text($(a)).trim(),
              slug: this.slugFromUrl(href),
              url: this.abs(href),
            })
          })
        if (items.length) groups.push({ letter, items })
      })
    })

    // Fallback flat list
    if (groups.length === 0) {
      const items = []
      $('a[href*="/anime/"]').each((_, a) => {
        const href = $(a).attr('href') || ''
        const title = this.text($(a)).trim()
        if (title.length < 2) return
        items.push({ title, slug: this.slugFromUrl(href), url: this.abs(href) })
      })
      return [{ letter: 'ALL', items }]
    }

    return groups
  }
}

// ---- Singleton helpers ----
const otaku = new Otakudesu()
export const otakuHome = () => otaku.home()
export const otakuOngoing = (page = 1) => otaku.ongoing(page)
export const otakuComplete = (page = 1) => otaku.complete(page)
export const otakuSearch = (q) => otaku.search(q)
export const otakuDetail = (slug) => otaku.anime(slug)
export const otakuEpisode = (slug) => otaku.episode(slug)
export const otakuSchedule = () => otaku.schedule()
export const otakuGenres = () => otaku.genres()
export const otakuGenre = (slug, page = 1) => otaku.genre(slug, page)
export { Otakudesu }
export default Otakudesu

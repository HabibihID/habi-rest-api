// lib/downloaders/reddit.js — Reddit downloader (HABI REST API)
// Ditulis dari nol: ambil JSON publik postingan Reddit (<url>.json),
// ekstrak video (fallback_url), gambar, atau gif. Tanpa login.
//
// CATATAN: Reddit memblokir banyak IP datacenter (403 "Blocked") — bila
// server kena blokir, endpoint ini mengembalikan pesan yang jelas soal
// itu (bukan error generik), sama seperti kasus blokir IP provider lain.

import https from 'node:https'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode === 403) return reject(new Error('Reddit memblokir akses dari IP server ini (403). Konten Reddit tidak bisa diambil dari server saat ini — batasan dari sisi Reddit untuk IP datacenter.'))
        if (res.statusCode === 404) return reject(new Error('Postingan tidak ditemukan (404) — link mungkin salah atau sudah dihapus'))
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
        try { resolve(JSON.parse(text)) } catch { reject(new Error('Respons Reddit tidak valid')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout mengambil data Reddit')) })
  })
}

/** Ekstrak media dari objek postingan Reddit. Diekspor untuk pengujian. */
export function parseRedditPost(post) {
  if (!post) return null
  const base = { title: post.title || '', subreddit: post.subreddit_name_prefixed || ('r/' + (post.subreddit || '')) }
  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    return { ...base, type: 'video', url: post.media.reddit_video.fallback_url }
  }
  if (post.is_gallery && post.media_metadata) {
    const first = Object.values(post.media_metadata)[0]
    const url = first?.s?.u?.replace(/&amp;/g, '&')
    if (url) return { ...base, type: 'image', url }
  }
  const direct = post.url_overridden_by_dest || post.url || ''
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(direct)) return { ...base, type: 'image', url: direct }
  if (/\.gifv?(\?|$)/i.test(direct)) return { ...base, type: 'image', url: direct.replace(/\.gifv$/i, '.gif') }
  if (/\.mp4(\?|$)/i.test(direct)) return { ...base, type: 'video', url: direct }
  const pv = post.preview?.reddit_video_preview?.fallback_url
  if (pv) return { ...base, type: 'video', url: pv }
  return null
}

export async function redditDl(rawUrl) {
  let u
  try { u = new URL(String(rawUrl || '')) } catch { throw new Error('URL tidak valid') }
  if (!/(^|\.)reddit\.com$/i.test(u.hostname) && u.hostname !== 'redd.it') {
    throw new Error('Link bukan Reddit — kirim link reddit.com')
  }
  if (u.hostname === 'redd.it') u.hostname = 'www.reddit.com'
  const clean = u.toString().replace(/\/+$/, '')
  const j = await httpsJson(clean + '.json?raw_json=1')
  const post = j?.[0]?.data?.children?.[0]?.data
  if (!post) throw new Error('Postingan tidak ditemukan — link mungkin salah atau sudah dihapus')
  if (post.over_18) throw new Error('Postingan ini ditandai 18+ (NSFW) — tidak bisa diunduh')
  const media = parseRedditPost(post)
  if (!media) throw new Error('Postingan ini tidak berisi video/gambar yang bisa diunduh (mungkin postingan teks atau link keluar)')
  return { status: true, result: { ...media, source: clean } }
}

export default redditDl

// Data source komentar TikTok — TANPA bypass anti-bot/CAPTCHA/fingerprint.
// Menggunakan endpoint publik TikTok dengan header standar.
// KETERBATASAN: TikTok agresif memblokir IP datacenter. Jika diblokir,
// API mengembalikan error jelas (bukan dipaksa/bypass).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function resolveUrl(url) {
  // resolve short URL (vt.tiktok.com, vm.tiktok.com) ke URL penuh
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    return res.url || url
  } catch {
    return url
  }
}

function extractVideoId(url) {
  const m = url.match(/video\/(\d+)/)
  return m ? m[1] : null
}

export async function getComments(tiktokUrl, maxComments = 100) {
  // 1. resolve short URL dulu
  const fullUrl = await resolveUrl(tiktokUrl)
  const videoId = extractVideoId(fullUrl)
  if (!videoId) {
    return { ok: false, error: 'URL TikTok tidak valid.', code: 'INVALID_URL' }
  }

  // 2. coba endpoint publik TikTok (tanpa bypass)
  try {
    const apiUrl = `https://www.tiktok.com/api/comment/list/?aweme_id=${videoId}&count=50&cursor=0`
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (res.status === 403 || res.status === 429) {
      return {
        ok: false,
        error: 'TikTok memblokir akses dari server ini (IP datacenter). Tidak bisa mengambil komentar tanpa bypass anti-bot.',
        code: 'TIKTOK_BLOCKED',
      }
    }
    if (!res.ok) {
      return { ok: false, error: `TikTok merespons HTTP ${res.status}.`, code: 'TIKTOK_ERROR' }
    }

    const data = await res.json()
    const comments = (data.comments || []).slice(0, maxComments).map(c => ({
      username: c.user?.unique_id || c.user?.nickname || 'unknown',
      text: c.text || '',
    }))

    if (!comments.length) {
      return { ok: false, error: 'Tidak ada komentar yang bisa diambil.', code: 'NO_COMMENTS' }
    }

    return { ok: true, comments, total: comments.length, videoId }
  } catch (e) {
    return { ok: false, error: `Gagal menghubungi TikTok: ${e.message}`, code: 'FETCH_ERROR' }
  }
}

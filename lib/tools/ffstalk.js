// FF Stalk — Profil Free Fire by UID untuk HABI REST API.
// Diadaptasi dari scraper FF Stalker (WILLzzz Market, base adenpedia.my.id)
// atas kiriman user 2026-10-21. Output dinormalisasi (tanpa raw mentah).
import axios from 'axios'

const BASE_API_URL = 'https://adenpedia.my.id/update01/info.php'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://adenpedia.my.id',
  'Referer': 'https://adenpedia.my.id/update01/',
  'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?1',
  'Sec-Ch-Ua-Platform': '"Android"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

const client = axios.create({
  timeout: 30000,
  headers: DEFAULT_HEADERS,
  validateStatus: (s) => s >= 200 && s < 500,
})

export function sanitizeUid(input) {
  if (!input) return ''
  return String(input).replace(/\D/g, '')
}

function formatDate(unixTimestamp) {
  if (!unixTimestamp) return null
  const ts = parseInt(unixTimestamp, 10)
  if (isNaN(ts)) return null
  return new Date(ts * 1000).toISOString()
}

/**
 * Ambil info akun Free Fire berdasarkan UID.
 * Return data ternormalisasi; throw Error bila UID invalid / akun tak ditemukan.
 */
export async function getFFInfo(rawUid) {
  const uid = sanitizeUid(rawUid)

  if (!uid) throw new Error('UID Free Fire wajib diisi dan hanya boleh berisi angka.')
  if (uid.length < 5) throw new Error('UID terlalu pendek! Minimal 5 digit angka.')

  let res
  try {
    res = await client.get(`${BASE_API_URL}?uid=${encodeURIComponent(uid)}`)
  } catch (err) {
    throw new Error(`Gagal melakukan koneksi ke server: ${err.message}`)
  }

  const json = res.data
  if (!json || typeof json !== 'object') {
    throw new Error(`Respons API tidak valid (Status HTTP: ${res.status})`)
  }

  if (json.error || !json.basicInfo) {
    const errorMsg = json.error || json.message || 'Akun tidak ditemukan atau UID salah.'
    throw new Error(`API mengembalikan error: ${errorMsg}`)
  }

  const basic = json.basicInfo || {}
  const profile = json.profileInfo || {}
  const clan = json.clanBasicInfo || {}
  const social = json.socialInfo || {}
  const pet = json.petInfo || {}
  const credit = json.creditScoreInfo || {}
  const prime = basic.primeInfo || {}

  return {
    uid,
    account: {
      nickname: basic.nickname || 'Unknown',
      level: basic.level ?? 0,
      exp: basic.exp ?? 0,
      region: basic.region || null,
      createAt: formatDate(basic.createAt),
      lastLoginAt: formatDate(basic.lastLoginAt),
      liked: basic.liked ?? 0,
      signature: social.signature || profile.signature || '',
      language: social.language || null,
    },
    rank: {
      brRank: basic.rank ?? 0,
      brPoints: basic.rankingPoints ?? 0,
      csRank: basic.csRank ?? 0,
      csPoints: basic.csRankingPoints ?? 0,
    },
    clan: clan.clanId ? {
      id: clan.clanId,
      name: clan.clanName || null,
      level: clan.clanLevel ?? 0,
      memberCount: clan.memberNum ?? 0,
      capacity: clan.capacity ?? 0,
    } : null,
    pet: pet.id ? {
      id: pet.id,
      level: pet.level ?? 0,
      exp: pet.exp ?? 0,
      skinId: pet.skinId || null,
    } : null,
    creditScore: credit.creditScore ?? 0,
    elitePass: {
      primeLevel: prime.primeLevel ?? 0,
    },
  }
}

export default { getFFInfo, sanitizeUid }

// StalkML — Validasi & stalk akun Mobile Legends (ID + Zone) untuk HABI REST API.
// Diadaptasi dari kode StalkML (Vamz Spectre) atas kiriman user 2026-10-21:
// multi-engine fallback — (1) MLBB gateway isan, (2) Isan nickname resolver,
// (3) GoPay games inquiry. Output dinormalisasi untuk bot.
import axios from 'axios'

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
}

/**
 * Parsing input menjadi ID dan Zone ID.
 * Format diterima: "ID Zone", "ID(Zone)", "ID|Zone", "ID/Zone", atau 2 argumen terpisah.
 */
export function parseMlInput(rawId, rawZone) {
  if (!rawId) return null

  const str = String(rawId).trim()

  const matchParentheses = str.match(/^([0-9]{4,12})\s*[([{]([0-9]{3,8})[)\]}]$/)
  if (matchParentheses) {
    return { id: matchParentheses[1], zoneId: matchParentheses[2] }
  }

  const matchDelimited = str.match(/^([0-9]{4,12})[\s|/,;:]+([0-9]{3,8})$/)
  if (matchDelimited) {
    return { id: matchDelimited[1], zoneId: matchDelimited[2] }
  }

  if (rawZone) {
    const id = String(rawId).replace(/[^0-9]/g, '').trim()
    const zoneId = String(rawZone).replace(/[^0-9]/g, '').trim()
    if (id && zoneId) return { id, zoneId }
  }

  return null
}

const notFound = (id, zone) =>
  new Error(`Akun Mobile Legends dengan ID ${id} (${zone}) tidak ditemukan atau tidak valid.`)

/**
 * Stalk akun Mobile Legends. Return { id, zoneId, nickname, country, game, engine }.
 * Throw Error bila format salah / akun tidak ditemukan / semua engine gagal.
 */
export async function stalkMl(id, zoneId) {
  const parsed = parseMlInput(id, zoneId)

  if (!parsed) {
    throw new Error('Format input tidak valid. Masukkan ID dan Zone ID (contoh: 1114917746 13486 atau 1114917746(13486)).')
  }

  const { id: cleanId, zoneId: cleanZone } = parsed

  // 1. Engine 1: Primary MLBB Inquiry Gateway
  try {
    const res = await axios.get(
      `https://mlbb-api.isan.eu.org/find?id=${encodeURIComponent(cleanId)}&zone=${encodeURIComponent(cleanZone)}`,
      { headers: DEFAULT_HEADERS, timeout: 5000 }
    )

    if (res.data?.success && res.data?.name) {
      return {
        id: cleanId,
        zoneId: cleanZone,
        nickname: String(res.data.name).trim(),
        country: res.data.countryName || res.data.countryCode || 'Indonesia',
        game: 'Mobile Legends: Bang Bang',
        engine: 'Engine Primary (MLBB Gateway)',
      }
    }

    if (res.data?.success === false && res.data?.message?.toLowerCase().includes('not found')) {
      throw notFound(cleanId, cleanZone)
    }
  } catch (err) {
    if (err.message?.includes('tidak ditemukan')) throw err
    // Lanjut ke fallback berikutnya
  }

  // 2. Engine 2: Secondary Global Game Resolver
  try {
    const res = await axios.get(
      `https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(cleanId)}&zone=${encodeURIComponent(cleanZone)}`,
      { headers: DEFAULT_HEADERS, timeout: 6000 }
    )

    if (res.data?.success && res.data?.name) {
      return {
        id: cleanId,
        zoneId: cleanZone,
        nickname: String(res.data.name).trim(),
        country: res.data.country || 'Indonesia',
        game: 'Mobile Legends: Bang Bang',
        engine: 'Engine Secondary (Isan Resolver)',
      }
    }

    if (res.data?.success === false && res.data?.message?.toLowerCase().includes('not found')) {
      throw notFound(cleanId, cleanZone)
    }
  } catch (err) {
    if (err.message?.includes('tidak ditemukan')) throw err
  }

  // 3. Engine 3: Official GoPay Games Inquiry Gateway
  try {
    const res = await axios.post(
      'https://gopay.co.id/games/v1/order/user-account',
      {
        code: 'MOBILE_LEGENDS',
        data: {
          userId: cleanId,
          zoneId: cleanZone,
        },
      },
      {
        headers: {
          ...DEFAULT_HEADERS,
          'Content-Type': 'application/json',
        },
        timeout: 6000,
      }
    )

    const data = res.data?.data
    if (data && data.username) {
      return {
        id: cleanId,
        zoneId: cleanZone,
        nickname: String(data.username).trim(),
        country: data.countryOrigin ? String(data.countryOrigin).toUpperCase() : 'ID',
        game: 'Mobile Legends: Bang Bang',
        engine: 'Engine Tertiary (GoPay Official Gateway)',
      }
    }
  } catch (err) {
    if (
      err.response?.status === 404 ||
      err.response?.data?.message?.toLowerCase()?.includes('not recognized')
    ) {
      throw notFound(cleanId, cleanZone)
    }
  }

  throw new Error(`Akun Mobile Legends dengan ID ${cleanId} (${cleanZone}) tidak ditemukan atau server game sedang sibuk.`)
}

export default { stalkMl, parseMlInput }

// stalkMl — Info akun Mobile Legends by ID + Zone.
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
//
// MLBB tidak punya API publik resmi. Modul ini mencoba endpoint validasi
// publik milik Codashop (checkout top-up, tanpa key) sebagai upaya terbaik.
// Kalau gagal (sering: validasi ditolak server), return error jelas.

const ENDPOINT = 'https://order-sg.codashop.com/initPayment.action'

export async function stalkMl(id, zone) {
  const cleanId = String(id || '').trim()
  const cleanZone = String(zone || '').trim()
  if (!cleanId) throw new Error('ID wajib diisi')
  if (!cleanZone) throw new Error('Zone wajib diisi (contoh: 13486)')
  if (!/^\d{4,16}$/.test(cleanId)) throw new Error('ID tidak valid (harus angka)')
  if (!/^\d{3,8}$/.test(cleanZone)) throw new Error('Zone tidak valid (harus angka)')

  const body =
    'voucherPricePoint.id=4150&voucherPricePoint.price=1579&voucherPricePoint.variablePrice=0' +
    `&user.userId=${encodeURIComponent(cleanId)}&user.zoneId=${encodeURIComponent(cleanZone)}` +
    '&voucherTypeName=MOBILE_LEGENDS&shopLang=id_ID&voucherTypeId=1&gvtId=1'

  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 20000)
  let j
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      signal: c.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': 'https://www.codashop.com',
        'Referer': 'https://www.codashop.com/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    j = await r.json()
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Timeout (20 detik)' : `Validasi gagal: ${e.message}`)
  } finally {
    clearTimeout(t)
  }

  const nickname = j?.confirmationFields?.username
  if (nickname) {
    return {
      id: cleanId,
      zone: cleanZone,
      nickname,
      game: 'Mobile Legends: Bang Bang',
    }
  }
  throw new Error(
    'ID/Zone tidak ditemukan atau validasi ditolak. MLBB tidak punya API publik resmi — ' +
    'data lengkap butuh API key pihak ketiga.'
  )
}

export default { stalkMl }

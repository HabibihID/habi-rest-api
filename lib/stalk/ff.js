// stalkFf — Info akun Free Fire by ID.
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
//
// Free Fire tidak punya API publik resmi. Modul ini mencoba endpoint validasi
// publik milik Codashop (checkout top-up, tanpa key) sebagai upaya terbaik.
// Kalau gagal (sering: region-lock / validasi ditolak server), return error jelas.

const ENDPOINT = 'https://order-sg.codashop.com/initPayment.action'

async function codashopValidate(id) {
  const body =
    'voucherPricePoint.id=8050&voucherPricePoint.price=1000&voucherPricePoint.variablePrice=0' +
    `&user.userId=${encodeURIComponent(id)}` +
    '&voucherTypeName=FREEFIRE&shopLang=id_ID&voucherTypeId=1&gvtId=1'
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 20000)
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
    return await r.json()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout (20 detik)')
    throw e
  } finally {
    clearTimeout(t)
  }
}

export async function stalkFf(id) {
  const clean = String(id || '').trim()
  if (!clean) throw new Error('ID wajib diisi')
  if (!/^\d{4,16}$/.test(clean)) throw new Error('ID Free Fire tidak valid (harus angka)')

  const j = await codashopValidate(clean).catch(e => {
    throw new Error(`Validasi ID gagal dihubungi (${e.message})`)
  })

  const nickname = j?.confirmationFields?.username
  if (nickname) {
    return {
      id: clean,
      nickname,
      region: j?.confirmationFields?.region || null,
      game: 'Free Fire',
    }
  }
  throw new Error(
    'ID tidak ditemukan atau validasi ditolak. Free Fire tidak punya API publik resmi — ' +
    'data lengkap butuh API key pihak ketiga.'
  )
}

export default { stalkFf }

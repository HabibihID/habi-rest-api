// stalkFb — Info profil Facebook via meta tags publik (og:title, og:description, og:image).
// Ditulis dari nol untuk HABI REST API. Tanpa API key.
// FB sering menampilkan halaman login ke scraper; kalau begitu, return error jelas.

import { fetchText, meta, cleanUsername } from './_http.js'

export async function stalkFb(username) {
  const u = cleanUsername(username)
  if (!u) throw new Error('Username wajib diisi')

  let html
  try {
    html = await fetchText(`https://www.facebook.com/${u}/`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    })
  } catch (e) {
    throw new Error(`Facebook tidak bisa diakses (${e.message})`)
  }

  const title = meta(html, 'og:title') || ''
  const desc = meta(html, 'og:description') || ''
  const image = meta(html, 'og:image')

  // Halaman login = profil tidak bisa dibaca
  if (/Log in to Facebook|Log In or Sign Up/i.test(html) && !title) {
    throw new Error('Facebook meminta login — profil tidak bisa dibaca tanpa akun.')
  }
  if (!title) throw new Error('Profil tidak ditemukan atau dibatasi Facebook.')

  // og:title biasanya: "Nama | Facebook" atau "Nama - Facebook"
  const name = title.split('|')[0].split(' - ')[0].trim()

  return {
    name: name || null,
    username: u,
    about: desc || null,
    profile_pic: image,
    url: `https://www.facebook.com/${u}/`,
  }
}

export default { stalkFb }

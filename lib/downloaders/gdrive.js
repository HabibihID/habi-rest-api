// Google Drive — return direct download URL (file publik)
export async function gdriveDl(inputUrl) {
  const match = inputUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || inputUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('File ID tidak ditemukan')
  const fileId = match[1]

  // Coba dapatkan info file via direct link
  const direct = `https://drive.google.com/uc?export=download&id=${fileId}`
  const r = await fetch(direct, { method: 'HEAD', redirect: 'follow' })
  const ct = r.headers.get('content-type') || ''

  if (ct.includes('text/html')) {
    throw new Error('File tidak publik / butuh akses')
  }

  return {
    fileId,
    download: r.url || direct,
    note: 'Pastikan file bisa diakses publik (Anyone with link)'
  }
}

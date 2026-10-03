// Shortlink (pakai is.gd - sama kayak bot)
export async function shortlink(url) {
  const r = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`)
  if (!r.ok) throw new Error('Gagal membuat shortlink')
  const short = (await r.text()).trim()
  if (!short.startsWith('https://')) throw new Error('URL tidak valid untuk shortlink')
  return short
}

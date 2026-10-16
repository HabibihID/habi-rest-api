// Parser URL preset dari teks komentar TikTok.
// Mengekstrak SEMUA URL (tidak cuma 1): drive.google.com, alight creative,
// whatsapp channel, dan link preset lainnya.

const URL_RE = /https?:\/\/[^\s<>")\]]+/gi

// pola khusus preset Alight Motion
const PRESET_PATTERNS = [
  { type: 'XML', test: (u) => /drive\.google\.com/i.test(u) },
  { type: '5MB', test: (u) => /alight/i.test(u) && /creative|share/i.test(u) },
  { type: 'AlightLink', test: (u) => /alight\.link|alightcreative|eative\.com/i.test(u) },
  { type: 'WhatsApp', test: (u) => /whatsapp\.com\/channel|wa\.me/i.test(u) },
  { type: 'GoogleDrive', test: (u) => /drive\.google|docs\.google/i.test(u) },
  { type: 'Mega', test: (u) => /mega\.nz/i.test(u) },
  { type: 'MediaFire', test: (u) => /mediafire\.com/i.test(u) },
]

function cleanUrl(u) {
  // buang emoji dan karakter aneh di sekitar URL
  return u.replace(/[🔥❤️👍🙏✨💯🎵📥🔗]+/g, '').trim().replace(/[.,;:!?]+$/, '')
}

function classifyUrl(url) {
  for (const p of PRESET_PATTERNS) {
    if (p.test(url)) return p.type
  }
  return 'Link'
}

export function extractUrls(text) {
  if (!text) return []
  const raw = text.match(URL_RE) || []
  const seen = new Set()
  const out = []
  for (let u of raw) {
    u = cleanUrl(u)
    if (!u || seen.has(u)) continue
    // validasi minimal
    try { new URL(u) } catch { continue }
    seen.add(u)
    out.push({ url: u, type: classifyUrl(u) })
  }
  return out
}

export function parseComments(comments) {
  // comments: array { username, text }
  const all = []
  const byUser = {}
  for (const c of comments) {
    const urls = extractUrls(c.text)
    if (!urls.length) continue
    if (!byUser[c.username]) byUser[c.username] = []
    for (const u of urls) {
      // hindari duplikat global
      if (all.some(x => x.url === u.url)) continue
      const entry = { ...u, from: c.username }
      all.push(entry)
      byUser[c.username].push(entry)
    }
  }
  return { total: all.length, urls: all, byUser }
}

// /api/dns — DNS lookup
import dns from 'node:dns/promises'

export async function dnsLookup(domain, type = 'A') {
  if (!domain) throw new Error('Domain wajib diisi')
  domain = domain.replace(/^https?:\/\//, '').split('/')[0]
  const t = type.toUpperCase()
  try {
    if (t === 'A') return { type: 'A', records: await dns.resolve4(domain) }
    if (t === 'AAAA') return { type: 'AAAA', records: await dns.resolve6(domain) }
    if (t === 'MX') return { type: 'MX', records: await dns.resolveMx(domain) }
    if (t === 'TXT') return { type: 'TXT', records: (await dns.resolveTxt(domain)).map(r => r.join('')) }
    if (t === 'NS') return { type: 'NS', records: await dns.resolveNs(domain) }
    if (t === 'CNAME') return { type: 'CNAME', records: await dns.resolveCname(domain) }
    throw new Error('Tipe tidak didukung (A, AAAA, MX, TXT, NS, CNAME)')
  } catch (e) {
    throw new Error(`DNS gagal: ${e.message}`)
  }
}

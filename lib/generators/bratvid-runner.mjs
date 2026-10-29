// Runner render bratvid di proses TERPISAH — crash native di sini tidak
// menjatuhkan proses API utama. Argv: JSON {text, theme, blur, format, hold}.
// Output: video mentah ke stdout; error ke stderr + exit 1.
import { makeBrat, makeBratImage } from '/home/ubuntu/habi-rest-api/lib/generators/bratvid-engine.js'
try {
  const opts = JSON.parse(process.argv[2] || '{}')
  const buf = opts.mode === 'image' ? await makeBratImage(opts) : await makeBrat(opts)
  process.stdout.write(buf)
} catch (e) {
  console.error(e?.message || String(e))
  process.exit(1)
}

import express from 'express';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { existsSync, mkdirSync, writeFileSync as fsWrite, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const router = express.Router();

// ── Font CJK (Noto Sans JP) ──────────────────────────────────────────
// Font bawaan server (DejaVu) tidak punya glyph Jepang/CJK -> nama member
// tampil sebagai kotak (tofu). Unduh WOFF resmi Google Fonts sekali saja,
// daftarkan sebagai family 'Noto Sans JP', sebut di font string canvas.
const CJK_DIR = join(tmpdir(), 'habi-fonts');
const CJK_FONTS = [
  ['https://fonts.gstatic.com/s/notosansjp/v57/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75jY1Lw_.woff', 'noto-jp-400.woff'],
  ['https://fonts.gstatic.com/s/notosansjp/v57/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75jY1Lw_.woff', 'noto-jp-700.woff'],
];
let cjkReady = null;
function ensureCjkFonts() {
  if (!cjkReady) {
    cjkReady = (async () => {
      try {
        mkdirSync(CJK_DIR, { recursive: true });
        for (const [url, name] of CJK_FONTS) {
          const file = join(CJK_DIR, name);
          if (!existsSync(file)) {
            const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!r.ok) throw new Error('font HTTP ' + r.status);
            fsWrite(file, Buffer.from(await r.arrayBuffer()));
          }
          GlobalFonts.registerFromPath(file, 'Noto Sans JP');
        }
      } catch { /* font gagal = render tetap jalan dengan font bawaan */ }
    })();
  }
  return cjkReady;
}

// ── Emoji sebagai gambar ────────────────────────────────────────────
// Font teks tidak bisa menggambar emoji berwarna (jadi kotak/tofu di
// nama member / nama grup). Emoji diambil sebagai PNG Apple lalu
// disisipkan sejajar teks.
const EMOJI_SRC = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/{code}.png';
const emojiImgCache = new Map();
const graphemeSeg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const isEmojiSeg = (t) => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(t);
async function emojiImage(seg) {
  if (emojiImgCache.has(seg)) return emojiImgCache.get(seg);
  const base = Array.from(seg, (ch) => ch.codePointAt(0).toString(16).padStart(4, '0')).join('-');
  let img = null;
  for (const code of new Set([base, base.replaceAll('-fe0f', '')])) {
    try {
      const r = await fetch(EMOJI_SRC.replace('{code}', code), { signal: AbortSignal.timeout(8000) });
      if (r.ok) { img = await loadImage(Buffer.from(await r.arrayBuffer())); break; }
    } catch { /* varian berikutnya */ }
  }
  emojiImgCache.set(seg, img);
  return img;
}
async function emojiParts(ctx, text, size) {
  const segs = [...graphemeSeg.segment(String(text))].map((x) => x.segment);
  const parts = [];
  for (const seg of segs) {
    if (isEmojiSeg(seg)) {
      parts.push({ emoji: true, img: await emojiImage(seg), w: size * 1.04 });
    } else {
      const last = parts[parts.length - 1];
      if (last && !last.emoji) { last.text += seg; last.w = ctx.measureText(last.text).width; }
      else parts.push({ emoji: false, text: seg, w: ctx.measureText(seg).width });
    }
  }
  return parts;
}
function fitSize(ctx, text, maxWidth, maxSize, minSize, weight) {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px "Noto Sans JP", sans-serif`;
    let w = 0;
    for (const seg of [...graphemeSeg.segment(String(text))].map((x) => x.segment)) {
      w += isEmojiSeg(seg) ? size * 1.04 : ctx.measureText(seg).width;
    }
    if (w <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}
async function drawTextEmojiLeft(ctx, text, x, y, size, weight, color) {
  ctx.font = `${weight} ${size}px "Noto Sans JP", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const parts = await emojiParts(ctx, text, size);
  let cx = x;
  for (const p of parts) {
    if (p.emoji) {
      if (p.img) ctx.drawImage(p.img, cx, y - size * 0.88, size * 1.04, size * 1.04);
    } else {
      ctx.fillText(p.text, cx, y);
    }
    cx += p.w;
  }
}

// Latar anime (build49) — file di public/assets/welcome/welcome-anime.jpg.
// Gagal muat -> gradasi gelap + bintang supaya kartu tetap terkirim.
const HERE = dirname(fileURLToPath(import.meta.url));
const BG_FILE = join(HERE, '..', 'public', 'assets', 'welcome', 'welcome-anime.jpg');
let bgCache = null;
async function loadBg() {
  if (bgCache) return bgCache;
  try {
    if (existsSync(BG_FILE)) bgCache = await loadImage(readFileSync(BG_FILE));
  } catch { bgCache = null; }
  return bgCache;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// GET /api/welcome?name=&avatar=&member=&group=
// Kartu welcome gaya anime (build49): panel kaca kiri + karakter di kanan,
// aksen pink sakura, pesan penutup CTA .menu. Branding Habibih Cloud ID.
router.get('/welcome', async (req, res) => {
  await ensureCjkFonts();
  try {
    const name = (req.query.name || 'Member').slice(0, 30);
    const avatarUrl = req.query.avatar || '';
    const memberNum = req.query.member || '';
    const groupName = (req.query.group || '').slice(0, 40);

    const W = 1200, H = 675;
    const accent = '#FFB7D5';
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bgImg = await loadBg();
    if (bgImg) {
      const s = Math.max(W / bgImg.width, H / bgImg.height);
      const dw = bgImg.width * s, dh = bgImg.height * s;
      ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const g = ctx.createLinearGradient(0, 0, 780, 0);
      g.addColorStop(0, 'rgba(5,8,18,0.88)');
      g.addColorStop(0.6, 'rgba(5,8,18,0.55)');
      g.addColorStop(1, 'rgba(5,8,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#1b1035');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      let seed = 21;
      const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      for (let i = 0; i < 300; i++) {
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * H, rnd() * 1.7 + 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(0.25 + rnd() * 0.65).toFixed(2)})`;
        ctx.fill();
      }
    }

    // Panel kaca kiri
    rr(ctx, 56, 56, 640, 563, 28);
    ctx.fillStyle = 'rgba(8,12,22,0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = accent;
    rr(ctx, 96, 88, 36, 4, 2);
    ctx.fill();
    ctx.font = '700 15px "Noto Sans JP", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText('NEW MEMBER', 144, 96);

    // Avatar bulat (foto member, fallback inisial)
    const ax = 96, ay = 122, asz = 118, acx = ax + asz / 2, acy = ay + asz / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(acx, acy, asz / 2, 0, Math.PI * 2);
    ctx.clip();
    let avatarLoaded = false;
    if (avatarUrl) {
      try {
        const img = await loadImage(avatarUrl);
        const ratio = Math.max(asz / img.width, asz / img.height);
        const aw = img.width * ratio, ah = img.height * ratio;
        ctx.drawImage(img, acx - aw / 2, acy - ah / 2, aw, ah);
        avatarLoaded = true;
      } catch {}
    }
    if (!avatarLoaded) {
      const av = ctx.createLinearGradient(ax, ay, ax + asz, ay + asz);
      av.addColorStop(0, '#3b2a4a'); av.addColorStop(1, '#16283a');
      ctx.fillStyle = av;
      ctx.fillRect(ax, ay, asz, asz);
      ctx.fillStyle = '#fff';
      ctx.font = '700 56px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      const firstSeg = [...graphemeSeg.segment(name)].map((x) => x.segment)[0] || 'M';
      const initImg = isEmojiSeg(firstSeg) ? await emojiImage(firstSeg) : null;
      if (initImg) ctx.drawImage(initImg, acx - 32, acy - 32, 64, 64);
      else ctx.fillText(firstSeg.toUpperCase(), acx, acy + 21);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(acx, acy, asz / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Nama + badge member
    await drawTextEmojiLeft(ctx, name, 238, 172, fitSize(ctx, name, 418, 38, 21, 700), 700, '#FFFFFF');
    if (memberNum) {
      ctx.font = '400 20px "Noto Sans JP", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(`Member #${memberNum}`, 238, 204);
    }

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(96, 272); ctx.lineTo(656, 272); ctx.stroke();

    // Grup
    ctx.font = '700 15px "Noto Sans JP", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText('SELAMAT DATANG DI', 96, 312);
    await drawTextEmojiLeft(ctx, groupName || 'Group', 96, 356, fitSize(ctx, groupName || 'Group', 560, 34, 20, 700), 700, '#FFFFFF');
    ctx.font = '400 19px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Seseorang baru saja bergabung.', 96, 388);

    // Chip
    const chip = (label, x) => {
      ctx.font = '700 15px "Noto Sans JP", sans-serif';
      const w = ctx.measureText(label).width + 32;
      rr(ctx, x, 416, w, 36, 18);
      ctx.fillStyle = hexA(accent, 0.12);
      ctx.fill();
      ctx.strokeStyle = hexA(accent, 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '700 15px "Noto Sans JP", sans-serif';
      ctx.fillStyle = accent;
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 16, 439);
      return x + w + 12;
    };
    let cx = 96;
    cx = chip('MEMBER BARU', cx);
    cx = chip('WELCOME', cx);

    // Pesan penutup — CTA .menu (permintaan user build49)
    ctx.font = '400 19px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('Silakan perkenalkan diri, baca peraturan,', 96, 500);
    ctx.fillText('lalu ketik .menu untuk menggunakan bot.', 96, 528);

    // Footer panel
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(96, 566); ctx.lineTo(656, 566); ctx.stroke();
    ctx.font = '600 14px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText('Habibih Cloud ID', 96, 594);
    ctx.font = '700 14px "Noto Sans JP", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'right';
    ctx.fillText('WELCOME CARD', 656, 594);

    const buf = canvas.toBuffer('image/png');
    res.set('Content-Type', 'image/png');
    res.set('Content-Length', buf.length);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

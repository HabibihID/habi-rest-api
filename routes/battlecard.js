import express from 'express';
import { createCanvas } from '@napi-rs/canvas';

const router = express.Router();

// GET /api/battlecard?title=&result=&stats=&color=
// Generate kartu hasil battle
router.get('/battlecard', async (req, res) => {
  try {
    const title = (req.query.title || 'BATTLE').slice(0, 40);
    const result = (req.query.result || '').slice(0, 100);
    const stats = (req.query.stats || '').slice(0, 200);
    const win = req.query.win === '1';

    const W = 700, H = 400;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    if (win) {
      bg.addColorStop(0, '#1a2e1a');
      bg.addColorStop(1, '#0d1f0d');
    } else {
      bg.addColorStop(0, '#2e1a1a');
      bg.addColorStop(1, '#1f0d0d');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Border glow
    ctx.strokeStyle = win ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(title, W / 2, 60);

    // Result icon
    ctx.font = '80px sans-serif';
    ctx.fillText(win ? '🏆' : '💀', W / 2, 160);

    // Result text
    ctx.fillStyle = win ? '#4ade80' : '#f87171';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(win ? 'VICTORY!' : 'DEFEAT', W / 2, 210);

    // Details
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '20px sans-serif';
    const lines = (result + '\n' + stats).split('\n').filter(Boolean).slice(0, 4);
    lines.forEach((line, i) => {
      ctx.fillText(line.slice(0, 50), W / 2, 250 + i * 30);
    });

    // Branding
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Habibih Cloud Store ID', W - 15, H - 12);

    const buf = canvas.toBuffer('image/png');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

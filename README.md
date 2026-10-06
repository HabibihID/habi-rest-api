# HABI REST API

REST API untuk bot WhatsApp HABI AI.

**Base URL:** `https://api.servercloud.my.id/api`
**Auth:** `?apikey=xxx` (kecuali `/health`)

---

## Instalasi VPS Baru

### 1. Node.js 22 (wajib!)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # harus v22.x
```

### 2. Dependensi

```bash
sudo apt update && sudo apt install -y ffmpeg python3 make g++ \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp
```

### 3. Clone & jalan

```bash
git clone https://github.com/HabibihID/habi-rest-api.git
cd habi-rest-api && npm install
sudo npm install -g pm2
pm2 start index.js --name habi-api && pm2 save && pm2 startup
```

### 4. Nginx + Cloudflare

```nginx
server {
    listen 80;
    server_name api.servercloud.my.id;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Cloudflare: DNS A `api` → IP VPS (Proxied), SSL **Flexible**.

---

## Endpoints Lengkap

### AI (20)
`/ai`, `/text2img`, `/translate`, `/sentiment`, `/stt` (POST), `/imgclass` (POST), `/cerita`, `/puisi`, `/resep`, `/itinerary`, `/sinopsis`, `/caption`, `/nama`, `/curhat`, `/motivasi`, `/tebak`, `/roast`, `/pantunai`, `/bluearchive`, `/randompap`

### Download (15)
`/tiktok`, `/tiktokaudio`, `/youtube`, `/facebook`, `/instagram`, `/twitter`, `/threads`, `/spotify`, `/capcut`, `/pinterest`, `/gdrive`, `/mediafire`, `/aio`, `/ytsearch`, `/yttranscript`

### Generator (17)
`/brat`, `/bratvid`, `/iqc`, `/iqc2`, `/qrcode`, `/ssweb`, `/meme`, `/shortlink`, `/fakech`, `/fakegc`, `/fakedana`, `/fakecall`, `/fakeovo`, `/igqc`, `/kalender`, `/translate`, `/ephoto`

### Tools (29)
`/removebg` (POST), `/tourl` (POST), `/blur` (POST), `/hd` (POST), `/hdvideo` (POST), `/skintoblack` (POST), `/wasted` (POST), `/wanted` (POST), `/watermark`, `/tts`, `/ocr`, `/ringkas`, `/crypto`, `/kurs`, `/anime`, `/github`, `/dns`, `/carbon`, `/speedtest`, `/wallpaper`, `/emojimix`, `/palette`, `/ephoto/effects`

### Games (6)
`/tebakbendera`, `/tebaklogo`, `/tebaklirik`, `/tebakapakahaku`, `/tebakkata`, `/caklontong`

### Islami (1)
`/kisahnabi`

**Total: ~88 endpoint**

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| better-sqlite3 error | Pakai Node 22! |
| canvas gagal | Install libcairo2-dev |
| 521 Cloudflare | SSL → Flexible |
| 429 | Max 60 req/menit |

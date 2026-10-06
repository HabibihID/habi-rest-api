#!/bin/bash
# HABI REST API - Auto Install Script
# Cara pakai: curl -sSL https://raw.githubusercontent.com/HabibihID/habi-rest-api/main/install.sh | bash
# Atau: bash install.sh

set -e

echo "🚀 HABI REST API Auto Installer"
echo "================================"

# 1. Node.js 22
echo "📦 Install Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
sudo apt install -y nodejs > /dev/null 2>&1
echo "   Node: $(node -v)"

# 2. Dependensi
echo "📦 Install ffmpeg & build tools..."
sudo apt update -qq
sudo apt install -y -qq ffmpeg python3 make g++ libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev > /dev/null 2>&1

# 3. yt-dlp
echo "📦 Install yt-dlp..."
sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp

# 4. Clone & npm install
echo "📦 Clone repo..."
cd ~
[ -d "habi-rest-api" ] && rm -rf habi-rest-api
git clone -q https://github.com/HabibihID/habi-rest-api.git
cd habi-rest-api
echo "📦 npm install (bisa 2-5 menit)..."
npm install --silent

# 5. PM2
echo "📦 Setup PM2..."
sudo npm install -g pm2 --silent
pm2 delete habi-api 2>/dev/null || true
pm2 start index.js --name habi-api
pm2 save

# 6. Nginx
echo "📦 Setup Nginx..."
sudo apt install -y -qq nginx > /dev/null 2>&1
read -p "🌐 Domain API (default: api.servercloud.my.id): " DOMAIN
DOMAIN=${DOMAIN:-api.servercloud.my.id}
sudo tee /etc/nginx/sites-available/habi-api > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/habi-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ SELESAI!"
echo "================================"
echo "🔗 API: http://$DOMAIN/api"
echo "💚 Health: curl http://localhost:3000/health"
echo "📊 PM2: pm2 logs habi-api"
echo ""
echo "⚠️  Jangan lupa:"
echo "   1. Arahkan DNS $DOMAIN ke IP VPS ini"
echo "   2. Set Cloudflare SSL ke Flexible"
echo "   3. Restore data.db kalau punya backup!"

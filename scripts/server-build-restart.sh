#!/usr/bin/env bash
# Run this ON THE SERVER after code is updated (e.g. after git pull, or after post-receive hook checkout).
# From your machine: ssh root@76.13.63.81 'cd /path/to/app && bash scripts/server-build-restart.sh'
# Or on the server from repo root: ./scripts/server-build-restart.sh
set -e
cd "$(dirname "$0")/.."
echo "==> Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
echo "==> Building..."
npm run build
echo "==> Restarting app..."
if command -v pm2 &>/dev/null; then
  pm2 restart flixcam 2>/dev/null || pm2 restart all 2>/dev/null || echo "  (pm2: no process named 'flixcam' or 'all' restarted)"
elif command -v systemctl &>/dev/null && systemctl is-active --quiet flixcam 2>/dev/null; then
  sudo systemctl restart flixcam
else
  echo "  Restart your Node process manually (pm2 restart, systemctl, or kill + start)"
fi
echo "==> Done."

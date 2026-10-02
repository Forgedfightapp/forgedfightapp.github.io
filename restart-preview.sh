#!/usr/bin/env bash
# Restart the local static server (port 8787) and the Cloudflare quick tunnel. Prints the new public URL.
pkill -f "http.server 8787" ; pkill -f "cloudflared tunnel --no-autoupdate --url http://localhost:8787" ; sleep 1
nohup python3 -m http.server 8787 --bind 127.0.0.1 --directory /workspace/bjj-tracker > /workspace/bjj-server.log 2>&1 &
echo "server pid $!"
nohup /workspace/bin/cloudflared tunnel --no-autoupdate --url http://localhost:8787 > /workspace/cloudflared.log 2>&1 &
echo "tunnel pid $!"
for i in $(seq 1 30); do U=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /workspace/cloudflared.log | head -1); [ -n "$U" ] && break; sleep 1; done
echo "public url: ${U:-<not ready, check /workspace/cloudflared.log>}"

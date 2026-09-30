#!/usr/bin/env bash
set -Eeuo pipefail

exec > >(tee -a /var/log/uniplug-bootstrap.log) 2>&1
export DEBIAN_FRONTEND=noninteractive

APP_DIR=/srv/uniplug/app
APP_REF=${UNIPLUG_REF:-codex/aws-lightsail}

apt-get update
apt-get install -y ca-certificates curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-22.sh
bash /tmp/nodesource-22.sh
apt-get install -y nodejs

if ! id uniplug >/dev/null 2>&1; then
  useradd --system --home-dir /srv/uniplug --create-home --shell /usr/sbin/nologin uniplug
fi
mkdir -p /etc/uniplug
git clone --depth 1 --branch "$APP_REF" https://github.com/ryanair000/uniplugke.git "$APP_DIR"
cp "$APP_DIR/config/aws-public.env" "$APP_DIR/.env.production"
cp "$APP_DIR/config/aws-public.env" /etc/uniplug/runtime.env
chown -R uniplug:uniplug /srv/uniplug
chown root:uniplug /etc/uniplug/runtime.env
chmod 0640 /etc/uniplug/runtime.env

cd "$APP_DIR"
runuser -u uniplug -- npm ci --no-audit --no-fund
runuser -u uniplug -- env NODE_OPTIONS=--max-old-space-size=3072 npm run build

cat > /etc/systemd/system/uniplug.service <<'UNIT'
[Unit]
Description=UniPlug Next.js storefront and member portal
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=uniplug
Group=uniplug
WorkingDirectory=/srv/uniplug/app
Environment=NODE_ENV=production
EnvironmentFile=/etc/uniplug/runtime.env
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/nginx/sites-available/uniplug <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name uniplug.shop www.uniplug.shop vip.uniplug.shop _;
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
ln -sfn /etc/nginx/sites-available/uniplug /etc/nginx/sites-enabled/uniplug
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now uniplug nginx

#!/usr/bin/env bash
set -Eeuo pipefail

# Stages the new domain beside the existing port-3103 release. No legacy redirects.
APP_REV=${1:?Pass the verified 40-character Git commit SHA}
[[ "$APP_REV" =~ ^[a-f0-9]{40}$ ]] || exit 2
APP_ROOT=/srv/aws-sites/uniplug
CURRENT_APP="$APP_ROOT/app"
RELEASE_DIR="$APP_ROOT/releases/co-ke-$APP_REV"
[[ ! -e "$RELEASE_DIR" ]] || { echo "Release already exists; inspect it before retrying." >&2; exit 1; }
[[ -f "$CURRENT_APP/package-lock.json" ]] || exit 1
mkdir -p "$RELEASE_DIR"
curl --fail --silent --show-error --location \
  "https://codeload.github.com/ryanair000/uniplugke/tar.gz/$APP_REV" \
  | tar -xz --strip-components=1 -C "$RELEASE_DIR"

# Compare parsed lockfiles: the original deployment normalized line endings.
python3 - "$CURRENT_APP/package-lock.json" "$RELEASE_DIR/package-lock.json" <<'PY'
import json, pathlib, sys
assert json.loads(pathlib.Path(sys.argv[1]).read_text()) == json.loads(pathlib.Path(sys.argv[2]).read_text()), 'Dependency lockfiles differ'
PY
cp "$CURRENT_APP/.env.production" "$RELEASE_DIR/.env.production"
python3 - "$RELEASE_DIR/.env.production" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
updates = {
    'NEXT_PUBLIC_SITE_URL': 'https://uniplug.co.ke',
    'NEXT_PUBLIC_VIP_SITE_URL': 'https://vip.uniplug.co.ke',
}
lines = [line for line in path.read_text().splitlines() if line.split('=', 1)[0] not in updates]
path.write_text('\n'.join(lines + [f'{key}={value}' for key, value in updates.items()]) + '\n')
PY
chown -Rh uniplug:uniplug "$RELEASE_DIR"
chmod 0600 "$RELEASE_DIR/.env.production"
cd "$RELEASE_DIR"
runuser -u uniplug -- npm ci --no-audit --no-fund > "$RELEASE_DIR/install.log" 2>&1
runuser -u uniplug -- node scripts/verify-domains.mjs
runuser -u uniplug -- env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1024 \
  nice -n 10 npm run build > "$RELEASE_DIR/build.log" 2>&1

cat > /etc/systemd/system/aws-site-uniplug-co-ke.service <<UNIT
[Unit]
Description=UniPlug co.ke migration release
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=uniplug
Group=uniplug
WorkingDirectory=$RELEASE_DIR
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=HOME=$APP_ROOT
ExecStart=/usr/bin/node $RELEASE_DIR/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3113
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now aws-site-uniplug-co-ke
curl --fail --silent --show-error --retry 8 --retry-connrefused --retry-delay 1 \
  -H 'Host: uniplug.co.ke' http://127.0.0.1:3113/robots.txt

if ! grep -q '^# BEGIN UNIPLUG CO KE STAGING$' /etc/caddy/Caddyfile; then
  cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-uniplug-co-ke-$APP_REV"
  cat >> /etc/caddy/Caddyfile <<'CADDY'

# BEGIN UNIPLUG CO KE STAGING
uniplug.co.ke, vip.uniplug.co.ke {
    encode gzip
    reverse_proxy 127.0.0.1:3113
}
www.uniplug.co.ke {
    redir https://uniplug.co.ke{uri} permanent
}
# END UNIPLUG CO KE STAGING
CADDY
  if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
    systemctl reload caddy
  else
    cp -a "/etc/caddy/Caddyfile.before-uniplug-co-ke-$APP_REV" /etc/caddy/Caddyfile
    exit 1
  fi
fi
systemctl is-active aws-site-uniplug aws-site-uniplug-co-ke caddy
echo "Staged $APP_REV on port 3113. Existing shop/VIP routing retained."

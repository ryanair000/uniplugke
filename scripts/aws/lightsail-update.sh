#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/srv/uniplug/app
APP_REF=${1:-codex/aws-lightsail}
cd "$APP_DIR"
runuser -u uniplug -- git fetch origin "$APP_REF"
runuser -u uniplug -- git merge --ff-only FETCH_HEAD
runuser -u uniplug -- npm ci --no-audit --no-fund
runuser -u uniplug -- env NODE_OPTIONS=--max-old-space-size=3072 npm run build
systemctl restart uniplug
systemctl is-active --quiet uniplug

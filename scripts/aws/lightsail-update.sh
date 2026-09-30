#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/srv/uniplug/app
APP_REF=${1:-codex/aws-lightsail}
BUILD_HEAP_MB=${UNIPLUG_BUILD_HEAP_MB:-1536}
cd "$APP_DIR"
runuser -u uniplug -- git fetch origin "$APP_REF"
runuser -u uniplug -- git merge --ff-only FETCH_HEAD
runuser -u uniplug -- npm ci --no-audit --no-fund
runuser -u uniplug -- env NODE_OPTIONS="--max-old-space-size=$BUILD_HEAP_MB" npm run build
systemctl restart uniplug
systemctl is-active --quiet uniplug

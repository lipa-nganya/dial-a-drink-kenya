#!/usr/bin/env bash
# Start Cloud SQL Proxy in Docker for development DB, then run migrations.
# Requires: Docker, gcloud auth application-default login
# ADC is copied to /tmp/dad-adc so the container can read it (permission fix on Mac).
#
# Usage:
#   ./scripts/run-dev-migrations-docker.sh              # run migrations on host (proxy on 5434)
#   ./scripts/run-dev-migrations-docker.sh --in-container # run migrations inside Docker (same network as proxy)
#
# If you get "Connection terminated unexpectedly" from the host, use --in-container.

set -e
IN_CONTAINER=false
for arg in "$@"; do
  [ "$arg" = "--in-container" ] && IN_CONTAINER=true && break
done

PROJECT="dialadrink-production"
REGION="us-central1"
INSTANCE="dialadrink-db-dev"
CONNECTION="${PROJECT}:${REGION}:${INSTANCE}"
PROXY_NAME="cloud-sql-proxy-dev"
NETWORK="dev-migrations"
BACKEND_IMAGE="dialadrink-backend-migrate"

echo "🐳 Cloud SQL Proxy + migrations via Docker"
[ "$IN_CONTAINER" = true ] && echo "   Mode: migrations inside Docker (same network as proxy)"
echo "=========================================="

mkdir -p /tmp/dad-adc
cp "$HOME/.config/gcloud/application_default_credentials.json" /tmp/dad-adc/adc.json 2>/dev/null || {
  echo "❌ Run: gcloud auth application-default login"
  exit 1
}
chmod -R a+rX /tmp/dad-adc

docker network create "$NETWORK" 2>/dev/null || true
docker rm -f "$PROXY_NAME" 2>/dev/null || true
docker run -d \
  --name "$PROXY_NAME" \
  --network "$NETWORK" \
  -p 127.0.0.1:5434:5432 \
  -v "/tmp/dad-adc:/creds:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/creds/adc.json \
  --user root \
  gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0 \
  "$CONNECTION" --port 5432

echo "✅ Proxy started (host port 5434). Waiting..."
sleep 4

get_db_url() {
  local host_port="$1"
  python3 -c "
import os, json, subprocess, re
host_port = \"$host_port\"
p = subprocess.run(['gcloud','run','services','describe','deliveryos-development-backend','--region','us-central1','--project','dialadrink-production','--format','json'], capture_output=True, text=True, check=True)
env = next((c.get('env',[]) for c in json.loads(p.stdout).get('spec',{}).get('template',{}).get('spec',{}).get('containers',[])), [])
url = next((e.get('value','') for e in env if e.get('name')=='DATABASE_URL'), '')
url = re.sub(r'\?host=[^\s]*', '', url)
url = url.replace('@/', '@' + host_port + '/')
print(url, end='')
"
}

if [ "$IN_CONTAINER" = true ]; then
  export DATABASE_URL=$(get_db_url "cloud-sql-proxy-dev:5432")
  [ -z "$DATABASE_URL" ] && echo "❌ Could not get DATABASE_URL" && exit 1
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  echo "📦 Building backend image (one-time, may take a few min)..."
  docker build -t "$BACKEND_IMAGE" "$ROOT/backend" -q
  echo "🔌 Running migrations inside Docker (same network as proxy)..."
  docker run --rm \
    --network "$NETWORK" \
    -e DATABASE_URL \
    -e NODE_ENV=development \
    "$BACKEND_IMAGE" \
    node scripts/run-cloud-sql-migrations.js
else
  export DATABASE_URL=$(get_db_url "127.0.0.1:5434")
  [ -z "$DATABASE_URL" ] && echo "❌ Could not get DATABASE_URL" && exit 1
  echo "🔌 Running migrations on host..."
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$ROOT/backend"
  NODE_ENV=development node scripts/run-cloud-sql-migrations.js
fi

echo ""
echo "✅ Done. Stop proxy: docker rm -f $PROXY_NAME"

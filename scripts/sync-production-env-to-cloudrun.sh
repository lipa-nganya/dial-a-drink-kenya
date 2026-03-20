#!/bin/bash
# Sync sensitive production env vars from your local .env/.env.local
# into the production Cloud Run services without pasting secrets here.
#
# IMPORTANT:
# - This script runs LOCALLY on your machine.
# - It reads values from backend/.env.local and backend/.env (if present).
# - It then updates Cloud Run env vars for:
#     - deliveryos-production-backend
#     - deliveryos-customer-frontend
#     - deliveryos-admin-frontend
# - It NEVER echoes the secret values, only the keys being updated.
# - SAFEGUARD: If your env contains M-Pesa SANDBOX credentials (shortcode 174379
#   or MPESA_ENVIRONMENT=sandbox), the script will REFUSE to sync unless you set
#   ALLOW_MPESA_SYNC=1. Only set that when your env file has real production
#   M-Pesa credentials; otherwise production will get 400 auth errors.

set -euo pipefail

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="$ROOT_DIR/backend"

cd "$ROOT_DIR"

echo "🔐 Syncing production env vars from $ENV_DIR/.env[.local] to Cloud Run..."

if [[ -f "$ENV_DIR/.env.local" ]]; then
  # Load local overrides first
  set -a
  # shellcheck disable=SC1091
  source "$ENV_DIR/.env.local"
  set +a
  echo "   Loaded backend/.env.local"
fi

if [[ -f "$ENV_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_DIR/.env"
  set +a
  echo "   Loaded backend/.env"
fi

# Default production PayBill if not set locally
if [[ -z "${MPESA_PAYBILL_ACCOUNT:-}" ]]; then
  MPESA_PAYBILL_ACCOUNT="7251353"
  echo "ℹ️  MPESA_PAYBILL_ACCOUNT not set in env; defaulting to 7251353 (existing production value)."
fi

# Strip wrapping single/double quotes if a user accidentally put them in their local env file.
strip_wrapping_quotes() {
  local v="$1"
  v="$(echo -n "$v" | sed "s/^'//; s/'$//; s/^\"//; s/\"$//")"
  echo -n "$v"
}

MPESA_SHORTCODE="$(strip_wrapping_quotes "${MPESA_SHORTCODE:-}")"
MPESA_PAYBILL_ACCOUNT="$(strip_wrapping_quotes "${MPESA_PAYBILL_ACCOUNT:-}")"
MPESA_CONSUMER_KEY="$(strip_wrapping_quotes "${MPESA_CONSUMER_KEY:-}")"
MPESA_CONSUMER_SECRET="$(strip_wrapping_quotes "${MPESA_CONSUMER_SECRET:-}")"
MPESA_PASSKEY="$(strip_wrapping_quotes "${MPESA_PASSKEY:-}")"

required_back_env=(
  MPESA_CONSUMER_KEY
  MPESA_CONSUMER_SECRET
  MPESA_SHORTCODE
  MPESA_PASSKEY
  MPESA_ENVIRONMENT
  MPESA_CALLBACK_URL
  PESAPAL_CONSUMER_KEY
  PESAPAL_CONSUMER_SECRET
  PESAPAL_ENVIRONMENT
  GOOGLE_MAPS_API_KEY
)

missing=()
for key in "${required_back_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "⚠️  The following env vars are not set in backend/.env[.local]:"
  for k in "${missing[@]}"; do
    echo "   - $k"
  done
  echo "   Set them locally first, then re-run this script."
  exit 1
fi

# Production backend MUST use production M-Pesa API and production callback (never sandbox)
PRODUCTION_MPESA_CALLBACK_URL="https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/callback"
MPESA_ENVIRONMENT_FOR_PROD="production"
PESAPAL_ENVIRONMENT_FOR_PROD="live"

# Safeguard: refuse to overwrite production with sandbox M-Pesa credentials
SANDBOX_SHORTCODE="174379"
if [[ "${MPESA_SHORTCODE:-}" == "$SANDBOX_SHORTCODE" ]] || [[ "${MPESA_ENVIRONMENT:-}" == "sandbox" ]]; then
  if [[ -z "${ALLOW_MPESA_SYNC:-}" ]] || [[ "${ALLOW_MPESA_SYNC}" != "1" ]]; then
    echo "❌ SAFEGUARD: Your env has M-Pesa SANDBOX credentials (shortcode $SANDBOX_SHORTCODE or MPESA_ENVIRONMENT=sandbox)."
    echo "   Pushing these to production would break live M-Pesa (400 auth)."
    echo "   Options:"
    echo "   1) Put PRODUCTION M-Pesa credentials in backend/.env.local, then re-run this script."
    echo "   2) If you truly intend to push sandbox (e.g. testing): ALLOW_MPESA_SYNC=1 $0"
    exit 1
  fi
  echo "⚠️  ALLOW_MPESA_SYNC=1 set: syncing M-Pesa anyway. Ensure your env has production credentials."
fi

echo "ℹ️  Production backend: forcing MPESA_ENVIRONMENT=$MPESA_ENVIRONMENT_FOR_PROD, MPESA_CALLBACK_URL=<production>, PESAPAL_ENVIRONMENT=$PESAPAL_ENVIRONMENT_FOR_PROD"

echo ""
echo "📦 Updating backend Cloud Run service: $BACKEND_SERVICE"
gcloud run services update "$BACKEND_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --update-env-vars \
MPESA_CONSUMER_KEY="$MPESA_CONSUMER_KEY",\
MPESA_CONSUMER_SECRET="$MPESA_CONSUMER_SECRET",\
MPESA_SHORTCODE="$MPESA_SHORTCODE",\
MPESA_PASSKEY="$MPESA_PASSKEY",\
MPESA_PAYBILL_ACCOUNT="$MPESA_PAYBILL_ACCOUNT",\
MPESA_ENVIRONMENT="$MPESA_ENVIRONMENT_FOR_PROD",\
MPESA_CALLBACK_URL="$PRODUCTION_MPESA_CALLBACK_URL",\
PESAPAL_CONSUMER_KEY="$PESAPAL_CONSUMER_KEY",\
PESAPAL_CONSUMER_SECRET="$PESAPAL_CONSUMER_SECRET",\
PESAPAL_ENVIRONMENT="$PESAPAL_ENVIRONMENT_FOR_PROD",\
GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" \
  --quiet

echo "✅ Backend env vars synced."

# Frontends: only need REACT_APP_GOOGLE_MAPS_API_KEY at runtime (for safety),
# but the key is primarily used at build time in Cloud Build. We still sync it
# here from your env so future manual Cloud Run updates have the correct value.

if [[ -n "${REACT_APP_GOOGLE_MAPS_API_KEY:-$GOOGLE_MAPS_API_KEY}" ]]; then
  FRONTEND_MAPS_KEY="${REACT_APP_GOOGLE_MAPS_API_KEY:-$GOOGLE_MAPS_API_KEY}"

  echo ""
  echo "🌐 Updating customer frontend service: $CUSTOMER_FRONTEND_SERVICE"
  gcloud run services update "$CUSTOMER_FRONTEND_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --update-env-vars \
REACT_APP_GOOGLE_MAPS_API_KEY="$FRONTEND_MAPS_KEY" \
    --quiet

  echo "🌐 Updating admin frontend service: $ADMIN_FRONTEND_SERVICE"
  gcloud run services update "$ADMIN_FRONTEND_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --update-env-vars \
REACT_APP_GOOGLE_MAPS_API_KEY="$FRONTEND_MAPS_KEY" \
    --quiet

  echo "✅ Frontend Maps keys synced."
else
  echo ""
  echo "⚠️  REACT_APP_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY not set in env."
  echo "   Frontend Maps key was NOT updated."
fi

echo ""
echo "🎉 Done. New revisions will roll out with the synced credentials."


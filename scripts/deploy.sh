#!/usr/bin/env bash

# Unified deployment helper for Dial-a-Drink services.
# Usage examples:
#   ./scripts/deploy.sh backend
#   ./scripts/deploy.sh customer admin
# Environment variables (override as needed):
#   PROJECT_ID               GCP project (required)
#   REGION                   Cloud Run / bucket region (default: us-central1)
#   BACKEND_SERVICE          Cloud Run service name (default: dialadrink-backend)
#   BACKEND_IMAGE            Container image (default: gcr.io/$PROJECT_ID/dialadrink-backend)
#   CUSTOMER_BUCKET          Storage bucket for customer site (default: $PROJECT_ID-customer-web)
#   ADMIN_BUCKET             Storage bucket for admin site (default: $PROJECT_ID-admin-web)
#   CDN_MAP_CUSTOMER         URL map for cache invalidation (optional)
#   CDN_MAP_ADMIN            URL map for cache invalidation (optional)

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-us-central1}
BACKEND_SERVICE=${BACKEND_SERVICE:-dialadrink-backend}
BACKEND_IMAGE=${BACKEND_IMAGE:-gcr.io/${PROJECT_ID}/dialadrink-backend}
BACKEND_CLOUDSQL_INSTANCE=${BACKEND_CLOUDSQL_INSTANCE:-drink-suite:us-central1:drink-suite-db}
BACKEND_ENV_VARS_LIST=${BACKEND_ENV_VARS_LIST:-DATABASE_URL JWT_SECRET MPESA_CONSUMER_KEY MPESA_CONSUMER_SECRET MPESA_PASSKEY MPESA_ENVIRONMENT MPESA_CALLBACK_URL GOOGLE_MAPS_API_KEY SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM FRONTEND_URL ADMIN_URL}
CUSTOMER_BUCKET=${CUSTOMER_BUCKET:-${PROJECT_ID}-customer-web}
ADMIN_BUCKET=${ADMIN_BUCKET:-${PROJECT_ID}-admin-web}
CUSTOMER_SERVICE=${CUSTOMER_SERVICE:-drink-suite-customer}
ADMIN_SERVICE=${ADMIN_SERVICE:-drink-suite-admin}
CUSTOMER_IMAGE=${CUSTOMER_IMAGE:-gcr.io/${PROJECT_ID}/drink-suite-customer-frontend}
ADMIN_IMAGE=${ADMIN_IMAGE:-gcr.io/${PROJECT_ID}/drink-suite-admin-frontend}
CDN_MAP_CUSTOMER=${CDN_MAP_CUSTOMER:-}
CDN_MAP_ADMIN=${CDN_MAP_ADMIN:-}

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID must be set." >&2
  exit 1
fi

ensure_tools() {
  command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI required"; exit 1; }
  command -v gsutil >/dev/null 2>&1 || { echo "gsutil required"; exit 1; }
}

deploy_backend() {
  echo "==> Deploying backend to Cloud Run (project: ${PROJECT_ID}, region: ${REGION})"
  gcloud config set project "${PROJECT_ID}" >/dev/null
  gcloud config set run/region "${REGION}" >/dev/null

  # Collect and validate environment variables that must be passed to Cloud Run
  local env_pairs=("NODE_ENV=production")
  for var_name in ${BACKEND_ENV_VARS_LIST}; do
    if [[ -z "${!var_name:-}" ]]; then
      echo "Environment variable ${var_name} must be set for backend deployment." >&2
      exit 1
    fi
    env_pairs+=("${var_name}=${!var_name}")
  done
  local env_string
  env_string=$(IFS=','; echo "${env_pairs[*]}")

  pushd backend >/dev/null
  echo "-> Building and submitting image ${BACKEND_IMAGE}"
  gcloud builds submit --tag "${BACKEND_IMAGE}" .

  echo "-> Deploying service ${BACKEND_SERVICE}"
  local deploy_cmd=(
    gcloud run deploy "${BACKEND_SERVICE}"
    --image "${BACKEND_IMAGE}"
    --region "${REGION}"
    --allow-unauthenticated
    --set-env-vars "${env_string}"
  )
  if [[ -n "${BACKEND_CLOUDSQL_INSTANCE}" ]]; then
    deploy_cmd+=(--add-cloudsql-instances "${BACKEND_CLOUDSQL_INSTANCE}")
  fi
  "${deploy_cmd[@]}"
  popd >/dev/null
}

deploy_customer() {
  echo "==> Deploying customer frontend to bucket ${CUSTOMER_BUCKET}"
  gcloud config set project "${PROJECT_ID}" >/dev/null

  pushd frontend >/dev/null
  npm install
  npm run build
  gcloud storage buckets describe "gs://${CUSTOMER_BUCKET}" >/dev/null 2>&1 || \
    gcloud storage buckets create "gs://${CUSTOMER_BUCKET}" --project="${PROJECT_ID}" --location="${REGION}" --uniform-bucket-level-access
  gcloud storage rsync --recursive build "gs://${CUSTOMER_BUCKET}"
  gcloud storage buckets add-iam-policy-binding "gs://${CUSTOMER_BUCKET}" \
    --member=allUsers --role=roles/storage.objectViewer >/dev/null
  gcloud storage buckets update "gs://${CUSTOMER_BUCKET}" \
    --web-main-page-suffix=index.html --web-error-page=index.html >/dev/null
  if [[ -n "${CDN_MAP_CUSTOMER}" ]]; then
    gcloud compute url-maps invalidate-cdn-cache "${CDN_MAP_CUSTOMER}" --path "/*"
  fi
  popd >/dev/null
}

deploy_customer_cloudrun() {
  echo "==> Building & deploying customer frontend to Cloud Run (${CUSTOMER_SERVICE})"
  gcloud config set project "${PROJECT_ID}" >/dev/null
  gcloud config set run/region "${REGION}" >/dev/null

  pushd frontend >/dev/null
  gcloud builds submit --tag "${CUSTOMER_IMAGE}" .
  gcloud run deploy "${CUSTOMER_SERVICE}" \
    --image "${CUSTOMER_IMAGE}" \
    --region "${REGION}" \
    --allow-unauthenticated
  popd >/dev/null
}

deploy_admin() {
  echo "==> Deploying admin frontend to bucket ${ADMIN_BUCKET}"
  gcloud config set project "${PROJECT_ID}" >/dev/null

  pushd admin-frontend >/dev/null
  npm install
  npm run build
  gcloud storage buckets describe "gs://${ADMIN_BUCKET}" >/dev/null 2>&1 || \
    gcloud storage buckets create "gs://${ADMIN_BUCKET}" --project="${PROJECT_ID}" --location="${REGION}" --uniform-bucket-level-access
  gcloud storage rsync --recursive build "gs://${ADMIN_BUCKET}"
  gcloud storage buckets add-iam-policy-binding "gs://${ADMIN_BUCKET}" \
    --member=allUsers --role=roles/storage.objectViewer >/dev/null
  gcloud storage buckets update "gs://${ADMIN_BUCKET}" \
    --web-main-page-suffix=index.html --web-error-page=index.html >/dev/null
  if [[ -n "${CDN_MAP_ADMIN}" ]]; then
    gcloud compute url-maps invalidate-cdn-cache "${CDN_MAP_ADMIN}" --path "/*"
  fi
  popd >/dev/null
}

deploy_admin_cloudrun() {
  echo "==> Building & deploying admin frontend to Cloud Run (${ADMIN_SERVICE})"
  gcloud config set project "${PROJECT_ID}" >/dev/null
  gcloud config set run/region "${REGION}" >/dev/null

  pushd admin-frontend >/dev/null
  gcloud builds submit --tag "${ADMIN_IMAGE}" .
  gcloud run deploy "${ADMIN_SERVICE}" \
    --image "${ADMIN_IMAGE}" \
    --region "${REGION}" \
    --allow-unauthenticated
  popd >/dev/null
}

usage() {
  cat <<EOF
Usage: PROJECT_ID=your-project ./scripts/deploy.sh [backend] [customer] [admin] [customer-cloudrun] [admin-cloudrun]

Targets:
  backend           Build & deploy Node API to Cloud Run.
  customer          Build React customer site and sync to Cloud Storage bucket.
  admin             Same as customer for admin dashboard.
  customer-cloudrun Build Docker image from frontend/ and deploy to Cloud Run.
  admin-cloudrun    Build Docker image from admin-frontend/ and deploy to Cloud Run.

You can deploy multiple targets in one run. Example:
  PROJECT_ID=drink-suite REGION=us-central1 ./scripts/deploy.sh backend customer
  PROJECT_ID=drink-suite REGION=us-central1 ./scripts/deploy.sh customer-cloudrun admin-cloudrun
EOF
}

main() {
  ensure_tools

  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  for target in "$@"; do
    case "${target}" in
      backend) deploy_backend ;;
      customer) deploy_customer ;;
      customer-cloudrun) deploy_customer_cloudrun ;;
      admin) deploy_admin ;;
      admin-cloudrun) deploy_admin_cloudrun ;;
      *) echo "Unknown target: ${target}" >&2; usage; exit 1 ;;
    esac
  done
}

main "$@"


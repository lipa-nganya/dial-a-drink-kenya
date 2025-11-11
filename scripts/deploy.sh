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
CUSTOMER_BUCKET=${CUSTOMER_BUCKET:-${PROJECT_ID}-customer-web}
ADMIN_BUCKET=${ADMIN_BUCKET:-${PROJECT_ID}-admin-web}
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

  pushd backend >/dev/null
  echo "-> Building and submitting image ${BACKEND_IMAGE}"
  gcloud builds submit --tag "${BACKEND_IMAGE}" .

  echo "-> Deploying service ${BACKEND_SERVICE}"
  gcloud run deploy "${BACKEND_SERVICE}" \
    --image "${BACKEND_IMAGE}" \
    --region "${REGION}" \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production,PORT=8080
  popd >/dev/null
}

deploy_customer() {
  echo "==> Deploying customer frontend to bucket ${CUSTOMER_BUCKET}"
  gcloud config set project "${PROJECT_ID}" >/dev/null

  pushd frontend >/dev/null
  npm ci
  npm run build
  gsutil ls "gs://${CUSTOMER_BUCKET}" >/dev/null 2>&1 || \
    gcloud storage buckets create "gs://${CUSTOMER_BUCKET}" --location="${REGION}" --project="${PROJECT_ID}" --uniform-bucket-level-access
  gsutil -m rsync -r build "gs://${CUSTOMER_BUCKET}"
  gsutil iam ch allUsers:objectViewer "gs://${CUSTOMER_BUCKET}"
  gsutil web set -m index.html -e index.html "gs://${CUSTOMER_BUCKET}"
  if [[ -n "${CDN_MAP_CUSTOMER}" ]]; then
    gcloud compute url-maps invalidate-cdn-cache "${CDN_MAP_CUSTOMER}" --path "/*"
  fi
  popd >/dev/null
}

deploy_admin() {
  echo "==> Deploying admin frontend to bucket ${ADMIN_BUCKET}"
  gcloud config set project "${PROJECT_ID}" >/dev/null

  pushd admin-frontend >/dev/null
  npm ci
  npm run build
  gsutil ls "gs://${ADMIN_BUCKET}" >/dev/null 2>&1 || \
    gcloud storage buckets create "gs://${ADMIN_BUCKET}" --location="${REGION}" --project="${PROJECT_ID}" --uniform-bucket-level-access
  gsutil -m rsync -r build "gs://${ADMIN_BUCKET}"
  gsutil iam ch allUsers:objectViewer "gs://${ADMIN_BUCKET}"
  gsutil web set -m index.html -e index.html "gs://${ADMIN_BUCKET}"
  if [[ -n "${CDN_MAP_ADMIN}" ]]; then
    gcloud compute url-maps invalidate-cdn-cache "${CDN_MAP_ADMIN}" --path "/*"
  fi
  popd >/dev/null
}

usage() {
  cat <<EOF
Usage: PROJECT_ID=your-project ./scripts/deploy.sh [backend] [customer] [admin]

Targets:
  backend   Build & deploy Node API to Cloud Run.
  customer  Build React customer site and sync to Cloud Storage bucket.
  admin     Same as customer for admin dashboard.

You can deploy multiple targets in one run. Example:
  PROJECT_ID=drink-suite REGION=us-central1 ./scripts/deploy.sh backend customer
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
      admin) deploy_admin ;;
      *) echo "Unknown target: ${target}" >&2; usage; exit 1 ;;
    esac
  done
}

main "$@"


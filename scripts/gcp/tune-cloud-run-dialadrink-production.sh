#!/usr/bin/env bash
# Target: materially lower Cloud Run cost without hurting UX (tune env vars after metrics).
#
# Main levers:
#   --cpu-throttling     CPU billed for request work + brief idle buffer (not full idle CPU)
#   --min-instances=0    no 24/7 idle instances (tradeoff: occasional cold start)
#   --concurrency        higher → fewer instances at same traffic (watch backend latency/RAM)
# Frontends (nginx):     0.5 vCPU + 512Mi is usually enough for static + proxy.
# Backend:               leave CPU/memory unset unless you export BACKEND_CPU / BACKEND_MEMORY
#                          (avoids accidentally increasing bill from this script).
#
# Docs: https://cloud.google.com/run/docs/configuring/services/cpu
#
# Dry run:  DRY_RUN=1 ./scripts/gcp/tune-cloud-run-dialadrink-production.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-dialadrink-production}"
REGION="${GCP_REGION:-us-central1}"

BACKEND_SERVICE="${BACKEND_SERVICE:-deliveryos-production-backend}"
CUSTOMER_FE="${CUSTOMER_FE:-deliveryos-customer-frontend}"
ADMIN_FE="${ADMIN_FE:-deliveryos-admin-frontend}"

# Optional — only applied if non-empty (inspect current: gcloud run services describe …)
BACKEND_CPU="${BACKEND_CPU:-}"
BACKEND_MEMORY="${BACKEND_MEMORY:-}"

BACKEND_CONCURRENCY="${BACKEND_CONCURRENCY:-60}"
BACKEND_MIN_INSTANCES="${BACKEND_MIN_INSTANCES:-0}"
BACKEND_MAX_INSTANCES="${BACKEND_MAX_INSTANCES:-25}"

FRONTEND_CPU="${FRONTEND_CPU:-0.5}"
FRONTEND_MEMORY="${FRONTEND_MEMORY:-512Mi}"
FRONTEND_CONCURRENCY="${FRONTEND_CONCURRENCY:-100}"
FRONTEND_MIN_INSTANCES="${FRONTEND_MIN_INSTANCES:-0}"
FRONTEND_MAX_INSTANCES="${FRONTEND_MAX_INSTANCES:-20}"

DRY_RUN="${DRY_RUN:-0}"

run_gcloud() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] $*"
  else
    "$@"
  fi
}

echo "Project=$PROJECT_ID  Region=$REGION  DRY_RUN=$DRY_RUN"
echo ""

update_frontend() {
  local name="$1"
  echo "=== $name (nginx/static) ==="
  run_gcloud gcloud run services update "$name" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --quiet \
    --cpu="$FRONTEND_CPU" \
    --memory="$FRONTEND_MEMORY" \
    --cpu-throttling \
    --min-instances="$FRONTEND_MIN_INSTANCES" \
    --max-instances="$FRONTEND_MAX_INSTANCES" \
    --concurrency="$FRONTEND_CONCURRENCY"
  echo ""
}

update_backend() {
  echo "=== $BACKEND_SERVICE (Node/API) ==="
  # Avoid "${arr[@]}" with empty arr under bash 3.x / set -u
  if [[ -n "$BACKEND_CPU" && -n "$BACKEND_MEMORY" ]]; then
    run_gcloud gcloud run services update "$BACKEND_SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --quiet \
      --cpu="$BACKEND_CPU" \
      --memory="$BACKEND_MEMORY" \
      --cpu-throttling \
      --min-instances="$BACKEND_MIN_INSTANCES" \
      --max-instances="$BACKEND_MAX_INSTANCES" \
      --concurrency="$BACKEND_CONCURRENCY"
  elif [[ -n "$BACKEND_CPU" ]]; then
    run_gcloud gcloud run services update "$BACKEND_SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --quiet \
      --cpu="$BACKEND_CPU" \
      --cpu-throttling \
      --min-instances="$BACKEND_MIN_INSTANCES" \
      --max-instances="$BACKEND_MAX_INSTANCES" \
      --concurrency="$BACKEND_CONCURRENCY"
  elif [[ -n "$BACKEND_MEMORY" ]]; then
    run_gcloud gcloud run services update "$BACKEND_SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --quiet \
      --memory="$BACKEND_MEMORY" \
      --cpu-throttling \
      --min-instances="$BACKEND_MIN_INSTANCES" \
      --max-instances="$BACKEND_MAX_INSTANCES" \
      --concurrency="$BACKEND_CONCURRENCY"
  else
    run_gcloud gcloud run services update "$BACKEND_SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --quiet \
      --cpu-throttling \
      --min-instances="$BACKEND_MIN_INSTANCES" \
      --max-instances="$BACKEND_MAX_INSTANCES" \
      --concurrency="$BACKEND_CONCURRENCY"
  fi
  echo ""
}

update_frontend "$CUSTOMER_FE"
update_frontend "$ADMIN_FE"
update_backend

echo "Done. If cold starts sting, consider BACKEND_MIN_INSTANCES=1 only on $BACKEND_SERVICE."
echo "Artifact Registry cost: add lifecycle rules / prune old images in console."
echo "Health: curl -sS https://deliveryos-production-backend-805803410802.us-central1.run.app/api/health"

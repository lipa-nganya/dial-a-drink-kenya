#!/usr/bin/env bash
# Target: keep development Cloud Run cost low (single QC user).
# Applies ONLY to the dev backend service.
#
# Safe to re-run after deploys (idempotent).
#
# Usage:
#   GCP_PROJECT_ID=dialadrink-production GCP_REGION=us-central1 \
#   BACKEND_SERVICE=deliveryos-development-backend \
#   ./scripts/gcp/tune-cloud-run-dialadrink-development.sh
#
# Optional overrides:
#   BACKEND_MIN_INSTANCES=0 BACKEND_MAX_INSTANCES=3 BACKEND_CPU=1 BACKEND_MEMORY=512Mi BACKEND_CONCURRENCY=20
#   DRY_RUN=1 ... (prints commands)
#
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-dialadrink-production}"
REGION="${GCP_REGION:-us-central1}"

BACKEND_SERVICE="${BACKEND_SERVICE:-deliveryos-development-backend}"

# Dev sizing defaults (lower than production; single user).
BACKEND_CPU="${BACKEND_CPU:-1}"
BACKEND_MEMORY="${BACKEND_MEMORY:-512Mi}"
BACKEND_CONCURRENCY="${BACKEND_CONCURRENCY:-20}"
BACKEND_MIN_INSTANCES="${BACKEND_MIN_INSTANCES:-0}"
BACKEND_MAX_INSTANCES="${BACKEND_MAX_INSTANCES:-3}"

DRY_RUN="${DRY_RUN:-0}"

run_gcloud() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] $*"
  else
    "$@"
  fi
}

echo "Project=$PROJECT_ID  Region=$REGION  Service=$BACKEND_SERVICE  DRY_RUN=$DRY_RUN"
echo "Dev controls: cpu=$BACKEND_CPU mem=$BACKEND_MEMORY min=$BACKEND_MIN_INSTANCES max=$BACKEND_MAX_INSTANCES conc=$BACKEND_CONCURRENCY"
echo ""

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

echo ""
echo "Done."


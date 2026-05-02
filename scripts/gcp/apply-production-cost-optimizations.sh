#!/usr/bin/env bash
# Applies production cost-control defaults (safe to re-run):
#   1) Cloud Run: backend 1 vCPU / 1Gi, min 1 / max 30, CPU throttling; frontends min 0.
#   2) Artifact Registry: cleanup policies from infra/gcp/artifact-registry-docker-lifecycle.json
#   3) Prints next step for BigQuery billing export (setup-billing-export-bigquery.sh + Console link).
#
# Optional GCR untagged digest cleanup (large gcr.io usage):
#   ./scripts/gcp/gcr-delete-untagged-digests.sh
#
# Usage:
#   GCP_PROJECT_ID=dialadrink-production ./scripts/gcp/apply-production-cost-optimizations.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PROJECT_ID="${GCP_PROJECT_ID:-dialadrink-production}"
REGION="${GCP_REGION:-us-central1}"

export GCP_PROJECT_ID="${PROJECT_ID}"
export GCP_REGION="${REGION}"

echo "=== 1) Cloud Run (tune script: warm API only, scale-to-zero frontends, right-size CPU/RAM) ==="
export BACKEND_CPU="${BACKEND_CPU:-1}"
export BACKEND_MEMORY="${BACKEND_MEMORY:-1Gi}"
export BACKEND_MIN_INSTANCES="${BACKEND_MIN_INSTANCES:-1}"
export BACKEND_MAX_INSTANCES="${BACKEND_MAX_INSTANCES:-30}"
export BACKEND_CONCURRENCY="${BACKEND_CONCURRENCY:-60}"
export FRONTEND_MIN_INSTANCES="${FRONTEND_MIN_INSTANCES:-0}"
export FRONTEND_MAX_INSTANCES="${FRONTEND_MAX_INSTANCES:-10}"
export FRONTEND_CPU="${FRONTEND_CPU:-1}"
export FRONTEND_MEMORY="${FRONTEND_MEMORY:-512Mi}"
export FRONTEND_CONCURRENCY="${FRONTEND_CONCURRENCY:-80}"

chmod +x ./scripts/gcp/tune-cloud-run-dialadrink-production.sh
./scripts/gcp/tune-cloud-run-dialadrink-production.sh

echo ""
echo "=== 2) Artifact Registry cleanup policies (all Docker repos in ${REGION}) ==="
chmod +x ./scripts/gcp/apply-artifact-registry-lifecycle.sh
./scripts/gcp/apply-artifact-registry-lifecycle.sh

echo ""
echo "=== 3) BigQuery dataset for billing export (creates dataset; Console links billing) ==="
chmod +x ./scripts/gcp/setup-billing-export-bigquery.sh
GCP_PROJECT_ID="${PROJECT_ID}" ./scripts/gcp/setup-billing-export-bigquery.sh

echo ""
echo "Done. Optional: prune legacy gcr.io untagged digests → ./scripts/gcp/gcr-delete-untagged-digests.sh"

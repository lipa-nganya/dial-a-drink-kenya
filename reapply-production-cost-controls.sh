#!/usr/bin/env bash
# Re-apply production cost controls (idempotent — safe to run often: weekly, after deploys,
# or when you suspect Cloud Run / Artifact Registry settings drifted in the console).
#
# What runs (see scripts/gcp/apply-production-cost-optimizations.sh):
#   1) Cloud Run — backend min 0 (scale-to-zero) unless overridden, frontends scale-to-zero, CPU throttling, tuned limits
#   2) Artifact Registry — Docker image lifecycle / cleanup policies
#   3) BigQuery billing export dataset (no-op if already present; may print Console follow-up)
#
# Prerequisites: gcloud authenticated; project set or use env below.
#
# Usage:
#   ./reapply-production-cost-controls.sh
#
# Optional overrides (same as underlying scripts):
#   GCP_PROJECT_ID=my-project GCP_REGION=us-central1 ./reapply-production-cost-controls.sh
#   BACKEND_MIN_INSTANCES=1 FRONTEND_MIN_INSTANCES=0 ./reapply-production-cost-controls.sh
#
# Cloud Run only (dry run):
#   DRY_RUN=1 ./scripts/gcp/tune-cloud-run-dialadrink-production.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export GCP_PROJECT_ID="${GCP_PROJECT_ID:-dialadrink-production}"
export GCP_REGION="${GCP_REGION:-us-central1}"

TARGET="${ROOT}/scripts/gcp/apply-production-cost-optimizations.sh"
if [[ ! -f "$TARGET" ]]; then
  echo "Missing: $TARGET" >&2
  exit 1
fi
chmod +x "$TARGET"
exec "$TARGET"

#!/usr/bin/env bash
# Read Cloud Run built-in HTTP request logs. Latency ≈ billed CPU time per request (proxy for "expensive").
#
# Usage:
#   GCP_PROJECT_ID=dialadrink-production \
#   SERVICE=deliveryos-production-backend \
#   FRESHNESS=7d \
#   LIMIT=500 \
#   ./scripts/gcp/read-cloud-run-request-logs.sh
#
# Logs Explorer: paste the FILTER line printed below into the query box.

set -euo pipefail

PROJECT="${GCP_PROJECT_ID:-dialadrink-production}"
SERVICE="${SERVICE:-deliveryos-production-backend}"
REGION="${GCP_REGION:-us-central1}"
FRESHNESS="${FRESHNESS:-24h}"
LIMIT="${LIMIT:-200}"

FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\" AND resource.labels.location=\"${REGION}\" AND logName:\"run.googleapis.com%2Frequests\""

echo "=== Logs Explorer (Query) ==="
echo "${FILTER}"
echo ""
echo "=== gcloud sample (newest first; inspect latency column) ==="

gcloud logging read "${FILTER}" \
  --project="${PROJECT}" \
  --freshness="${FRESHNESS}" \
  --limit="${LIMIT}" \
  --format='table(timestamp,httpRequest.requestMethod,httpRequest.status,httpRequest.latency,httpRequest.requestUrl)'

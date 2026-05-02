#!/usr/bin/env bash
# Creates a BigQuery dataset for Google Cloud billing export. Linking the billing
# account to this dataset is done once in the Console (requires Billing Admin).
#
# After this script:
#   1) Google Cloud Console → Billing → Billing export → BigQuery export
#   2) Select project GCP_PROJECT_ID and dataset BQ_BILLING_DATASET (default billing_export)
#   3) Save — tables appear within ~24h (detailed cost line items).
#
# Usage:
#   GCP_PROJECT_ID=dialadrink-production ./scripts/gcp/setup-billing-export-bigquery.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
DATASET_ID="${BQ_BILLING_DATASET:-billing_export}"
# Billing exports typically use the US or EU multi-region dataset location.
LOCATION="${BQ_LOCATION:-US}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT" >&2
  exit 1
fi

echo "Project: ${PROJECT_ID}"
echo "Dataset: ${DATASET_ID} (location=${LOCATION})"
echo ""

echo "Enabling APIs (safe if already on)..."
gcloud services enable bigquery.googleapis.com --project="${PROJECT_ID}" >/dev/null

if bq show --project_id="${PROJECT_ID}" "${PROJECT_ID}:${DATASET_ID}" >/dev/null 2>&1; then
  echo "Dataset ${PROJECT_ID}:${DATASET_ID} already exists."
else
  echo "Creating dataset ${PROJECT_ID}:${DATASET_ID} ..."
  bq mk --project_id="${PROJECT_ID}" --dataset --location="${LOCATION}" "${DATASET_ID}"
  echo "Created."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Manual step (Billing Account Administrator):"
echo "  https://console.cloud.google.com/billing/export — BigQuery export"
echo "  • Pick this billing account → Detailed usage cost → Edit settings"
echo "  • Projects with billing enabled → ${PROJECT_ID}"
echo "  • Dataset → ${DATASET_ID}"
echo ""
echo "Query examples (after export populates):"
echo "  bq show --project_id=${PROJECT_ID} ${DATASET_ID}"
echo "  (See exported tables gcp_billing_export_* in Console → BigQuery → ${DATASET_ID})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

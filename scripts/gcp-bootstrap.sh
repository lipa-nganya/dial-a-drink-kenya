#!/usr/bin/env bash

# Generic GCP project bootstrap focused on low-cost defaults.
# Usage:
#   export PROJECT_ID="your-project-id"
#   export BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"   # optional
#   export ORG_ID="1234567890"                      # optional (mutually exclusive with FOLDER_ID)
#   export FOLDER_ID="3456789012"                   # optional
#   export REGION="us-central1"                     # optional
#   export ZONE="us-central1-c"                     # optional
#   export BUDGET_AMOUNT=50                         # optional, USD/month
#   export BUDGET_DISPLAY_NAME="Dev budget"         # optional
#   ./scripts/gcp-bootstrap.sh

set -euo pipefail

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Error: \$$name must be set." >&2
    exit 1
  fi
}

PROJECT_ID="${PROJECT_ID:-}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
ORG_ID="${ORG_ID:-}"
FOLDER_ID="${FOLDER_ID:-}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-c}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-}"
BUDGET_DISPLAY_NAME="${BUDGET_DISPLAY_NAME:-Dial-a-Drink Cost Ceiling}"

require_var PROJECT_ID

log "Ensuring gcloud CLI is installed..."
if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required. Install from https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

log "Checking existing project..."
if gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
  log "Project ${PROJECT_ID} already exists. Skipping creation."
else
  create_args=( "${PROJECT_ID}" )
  if [[ -n "${FOLDER_ID}" ]]; then
    create_args+=( "--folder=${FOLDER_ID}" )
  elif [[ -n "${ORG_ID}" ]]; then
    create_args+=( "--organization=${ORG_ID}" )
  fi
  log "Creating project ${PROJECT_ID}..."
  gcloud projects create "${create_args[@]}"
fi

log "Setting active project..."
gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud config set compute/region "${REGION}" >/dev/null
gcloud config set compute/zone "${ZONE}" >/dev/null

if [[ -n "${BILLING_ACCOUNT}" ]]; then
  log "Linking billing account ${BILLING_ACCOUNT}..."
  gcloud beta billing projects link "${PROJECT_ID}" \
    --billing-account="${BILLING_ACCOUNT}" >/dev/null
else
  log "Skipping billing linkage (BILLING_ACCOUNT not provided)."
fi

log "Enabling core APIs (only the essentials to keep spend low)..."
core_services=(
  serviceusage.googleapis.com
  cloudresourcemanager.googleapis.com
  iam.googleapis.com
  compute.googleapis.com
  run.googleapis.com
  sqladmin.googleapis.com
  artifactregistry.googleapis.com
  logging.googleapis.com
  monitoring.googleapis.com
)
gcloud services enable "${core_services[@]}"

log "Hardening defaults for cost savings..."
# Enable OS Login and disable serial port access to reduce attack surface.
gcloud compute project-info update-metadata \
  --metadata enable-oslogin=TRUE,serial-port-enable=FALSE

# Create a lean VPC and delete the default one (which opens extra firewall rules).
if gcloud compute networks describe default >/dev/null 2>&1; then
  log "Deleting default network (unsafe defaults)..."
  gcloud compute networks delete default --quiet
fi

if ! gcloud compute networks describe "${PROJECT_ID}-vpc" >/dev/null 2>&1; then
  log "Creating cost-conscious custom VPC..."
  gcloud compute networks create "${PROJECT_ID}-vpc" \
    --subnet-mode=custom \
    --bgp-routing-mode=regional
  gcloud compute networks subnets create "${PROJECT_ID}-subnet" \
    --network="${PROJECT_ID}-vpc" \
    --range=10.10.0.0/24 \
    --region="${REGION}"
  gcloud compute firewall-rules create "${PROJECT_ID}-allow-ssh" \
    --network="${PROJECT_ID}-vpc" \
    --allow=tcp:22 \
    --source-ranges=0.0.0.0/0 \
    --direction=INGRESS \
    --priority=1000 \
    --quiet
fi

log "Creating a minimal platform service account..."
if ! gcloud iam service-accounts describe "platform@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1; then
  gcloud iam service-accounts create platform \
    --display-name="dialadrink-platform"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:platform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.developer" \
  --role="roles/cloudsql.client" \
  --role="roles/storage.objectViewer" \
  --quiet

log "Disabling costly APIs you likely do not need..."
disable_services=(
  dataproc.googleapis.com
  bigquery.googleapis.com
  dataflow.googleapis.com
  composer.googleapis.com
  ml.googleapis.com
  container.googleapis.com
)
for svc in "${disable_services[@]}"; do
  gcloud services disable "${svc}" --quiet || true
done

if [[ -n "${BILLING_ACCOUNT}" && -n "${BUDGET_AMOUNT}" ]]; then
  log "Creating cost alert budget (amount: USD ${BUDGET_AMOUNT})..."
  gcloud alpha billing budgets create \
    --billing-account="${BILLING_ACCOUNT}" \
    --display-name="${BUDGET_DISPLAY_NAME}" \
    --budget-amount="${BUDGET_AMOUNT}" \
    --all-updates-rule-disable-default-alerts \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    >/dev/null || log "Budget creation failed (ensure billing budgets API is enabled)."
else
  log "Skipping budget creation (BUDGET_AMOUNT or BILLING_ACCOUNT not provided)."
fi

log "Bootstrap complete! Consider next steps:"
echo "  - Create environment-specific service accounts (dev/staging/prod)."
echo "  - Set up Infrastructure as Code (Terraform) to manage resources."
echo "  - Review IAM policies to keep least privilege."
echo "  - Schedule nightly shutdowns for any VM instances to minimize spend."


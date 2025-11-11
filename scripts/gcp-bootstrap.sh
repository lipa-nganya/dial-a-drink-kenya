#!/usr/bin/env bash

# Generic GCP project bootstrap focused on low-cost defaults.
# You can pre-set environment variables if you prefer (PROJECT_ID, BILLING_ACCOUNT, etc.),
# otherwise the script will interactively ask for the values it needs.

set -euo pipefail

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

ask_input() {
  local var_name="$1"
  local prompt="$2"
  local default="${3:-}"
  local required="${4:-optional}"
  local current="${!var_name:-}"

  if [[ -n "$current" ]]; then
    return
  fi

  local value=""
  while true; do
    if [[ -n "$default" ]]; then
      read -r -p "$prompt [$default]: " value || true
    else
      read -r -p "$prompt: " value || true
    fi

    if [[ -z "$value" ]]; then
      value="$default"
    fi

    if [[ "$required" == "required" && -z "$value" ]]; then
      echo "A value is required." >&2
      continue
    fi

    break
  done

  printf -v "$var_name" '%s' "$value"
}

PROJECT_ID="${PROJECT_ID:-}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
ORG_ID="${ORG_ID:-}"
FOLDER_ID="${FOLDER_ID:-}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-c}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-}"
BUDGET_DISPLAY_NAME="${BUDGET_DISPLAY_NAME:-Dial-a-Drink Cost Ceiling}"

ask_input PROJECT_ID "Enter the GCP project ID" "" "required"
ask_input BILLING_ACCOUNT "Enter the billing account ID (leave blank to skip linking)"
ask_input ORG_ID "Enter the organization ID (leave blank if not applicable)"
ask_input FOLDER_ID "Enter the folder ID (leave blank if not applicable)"
ask_input REGION "Enter the default region" "${REGION}"
ask_input ZONE "Enter the default zone" "${ZONE}"
ask_input BUDGET_AMOUNT "Enter monthly budget amount in USD (leave blank to skip budget creation)"
ask_input BUDGET_DISPLAY_NAME "Enter the budget display name" "${BUDGET_DISPLAY_NAME}"

if [[ -n "${ORG_ID}" && -n "${FOLDER_ID}" ]]; then
  echo "Warning: Both ORG_ID and FOLDER_ID provided. The folder takes precedence." >&2
fi

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
gcloud compute project-info add-metadata \
  --metadata enable-oslogin=TRUE,serial-port-enable=FALSE

# Create a lean VPC and delete the default one (which opens extra firewall rules).
if gcloud compute networks describe default >/dev/null 2>&1; then
  log "Deleting default network (unsafe defaults)..."
  for rule in default-allow-icmp default-allow-internal default-allow-rdp default-allow-ssh; do
    gcloud compute firewall-rules delete "${rule}" --quiet >/dev/null 2>&1 || true
  done
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
ACCOUNT_EMAIL="platform@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${ACCOUNT_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create platform \
    --display-name="dialadrink-platform"
fi

# Wait until the service account is visible to IAM (handles eventual consistency).
readonly MAX_ATTEMPTS=10
readonly SLEEP_SECONDS=5
attempt=1
while ! gcloud iam service-accounts describe "${ACCOUNT_EMAIL}" >/dev/null 2>&1; do
  if (( attempt >= MAX_ATTEMPTS )); then
    echo "Service account ${ACCOUNT_EMAIL} not visible after waiting. Exiting." >&2
    exit 1
  fi
  log "Waiting for service account to propagate (attempt ${attempt}/${MAX_ATTEMPTS})..."
  sleep "${SLEEP_SECONDS}"
  ((attempt++))
done

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${ACCOUNT_EMAIL}" \
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


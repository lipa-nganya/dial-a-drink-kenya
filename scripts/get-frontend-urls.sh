#!/usr/bin/env bash

# Helper script to surface the live URLs for the customer and admin static sites.
# It reports:
#   1. The bucket-backed website endpoint (storage.googleapis.com).
#   2. Any HTTPS load-balancer hostnames (via URL maps) that front the bucket.
#
# Usage:
#   PROJECT_ID=drink-suite ./scripts/get-frontend-urls.sh
# Optional overrides:
#   REGION=us-central1
#   CUSTOMER_BUCKET=<bucket-name>
#   ADMIN_BUCKET=<bucket-name>
#
# The script is read-only; it just queries gcloud / gsutil.

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-us-central1}
CUSTOMER_BUCKET=${CUSTOMER_BUCKET:-${PROJECT_ID}-customer-web}
ADMIN_BUCKET=${ADMIN_BUCKET:-${PROJECT_ID}-admin-web}

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID must be set." >&2
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI required." >&2; exit 1; }
command -v gsutil >/dev/null 2>&1 || { echo "gsutil CLI required." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq CLI required." >&2; exit 1; }

info() {
  printf '[INFO] %s\n' "$*"
}

error() {
  printf '[WARN] %s\n' "$*" >&2
}

print_bucket_info() {
  local label=$1
  local bucket=$2
  if gcloud storage buckets describe "gs://${bucket}" >/dev/null 2>&1; then
    info "${label} bucket: gs://${bucket}"
    info "${label} static URL: https://storage.googleapis.com/${bucket}/index.html"
  else
    error "${label} bucket gs://${bucket} not found (override CUSTOMER_BUCKET/ADMIN_BUCKET if needed)."
  fi
}

gather_lb_hosts() {
  local bucket=$1
  local -a hosts=()

  local backend_output
  backend_output=$(gcloud compute backend-buckets list \
    --project "${PROJECT_ID}" \
    --format='value(name,bucketName)' 2>/dev/null || true)

  local backend_name=""
  while IFS= read -r entry; do
    [[ -z "${entry}" ]] && continue
    local name bucket_name
    name=$(awk '{print $1}' <<<"${entry}")
    bucket_name=$(awk '{print $2}' <<<"${entry}")
    if [[ "${bucket_name}" == "${bucket}" ]]; then
      backend_name="${name}"
      break
    fi
  done <<<"${backend_output}"

  if [[ -z "${backend_name}" ]]; then
    return 0
  fi

  local url_map_output
  url_map_output=$(gcloud compute url-maps list \
    --project "${PROJECT_ID}" \
    --format='value(name)' 2>/dev/null || true)

  while IFS= read -r map; do
    [[ -z "${map}" ]] && continue

    local describe
    describe=$(gcloud compute url-maps describe "${map}" \
      --project "${PROJECT_ID}" \
      --format='json(hostRules,pathMatchers[],defaultService)')

    if jq -e --arg backend "${backend_name}" '
        (.defaultService // "") | test($backend)
        or any(.pathMatchers[]?.defaultService; test($backend))
        or any(.pathMatchers[]?.pathRules[]?.service; test($backend))
      ' <<<"${describe}" >/dev/null; then
      local map_hosts
      map_hosts=$(jq -r '.hostRules[]?.hosts[]?' <<<"${describe}")
      if [[ -n "${map_hosts}" ]]; then
        while IFS= read -r host; do
          hosts+=("${host}")
        done <<<"${map_hosts}"
      fi
    fi
  done <<<"${url_map_output}"

  if (( ${#hosts[@]} )); then
    printf '%s\n' "${hosts[@]}" | sort -u
  fi
}

print_lb_info() {
  local label=$1
  local bucket=$2

  local lb_hosts
  lb_hosts=$(gather_lb_hosts "${bucket}" || true)

  if [[ -n "${lb_hosts}" ]]; then
    info "${label} CDN/HTTPS hostnames:"
    while IFS= read -r host; do
      info "  - https://${host}"
    done <<<"${lb_hosts}"
  else
    error "No HTTPS load balancer hostnames detected for ${label} (bucket ${bucket})."
  fi
}

echo "=== Frontend URL summary (project: ${PROJECT_ID}, region: ${REGION}) ==="
print_bucket_info "Customer" "${CUSTOMER_BUCKET}"
print_lb_info "Customer" "${CUSTOMER_BUCKET}"
echo ""
print_bucket_info "Admin" "${ADMIN_BUCKET}"
print_lb_info "Admin" "${ADMIN_BUCKET}"
echo "======================================================================="



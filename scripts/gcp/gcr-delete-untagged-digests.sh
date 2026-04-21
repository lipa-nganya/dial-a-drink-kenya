#!/usr/bin/env bash
# Delete untagged image digests on Google Container Registry (gcr.io/$PROJECT/$IMAGE).
# Safe: only removes manifests with no tags (orphaned layers after repushes).
#
# Usage:
#   GCP_PROJECT_ID=my-proj ./scripts/gcp/gcr-delete-untagged-digests.sh
# Optional: IMAGES="deliveryos-backend dialadrink-frontend" (space-separated)
#
# Schedule weekly: Cloud Build config infra/gcp/cloudbuild-gcr-cleanup.yaml
#   gcloud builds submit --config=infra/gcp/cloudbuild-gcr-cleanup.yaml --project=YOUR_PROJECT .

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or: gcloud config set project YOUR_PROJECT" >&2
  exit 1
fi

DEFAULT_IMAGES=(
  deliveryos-backend
  dialadrink-frontend
  deliveryos-admin
  deliveryos-admin-dev
  dialadrink-shop-agent
)

if [[ -n "${IMAGES:-}" ]]; then
  read -ra TARGET_IMAGES <<< "${IMAGES}"
else
  TARGET_IMAGES=("${DEFAULT_IMAGES[@]}")
fi

for NAME in "${TARGET_IMAGES[@]}"; do
  IMG="gcr.io/${PROJECT_ID}/${NAME}"
  echo "=== ${IMG} ==="

  if ! gcloud container images describe "${IMG}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  (skip: image path not found)"
    continue
  fi

  # Digests that have no tags (orphaned manifests)
  while IFS= read -r DIGEST; do
    [[ -z "${DIGEST}" ]] && continue
    echo "  delete untagged digest ${DIGEST}"
    gcloud container images delete "${IMG}@${DIGEST}" \
      --project="${PROJECT_ID}" \
      --quiet \
      --force-delete-tags || true
  done < <(gcloud container images list-tags "${IMG}" \
    --project="${PROJECT_ID}" \
    --filter='-tags:*' \
    --format='get(digest)' 2>/dev/null || true)
done

echo "Done."

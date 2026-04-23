#!/usr/bin/env bash
# Apply Artifact Registry cleanup policies from infra/gcp/artifact-registry-docker-lifecycle.json
# to Docker repositories (same policy file can be reused across repos).
#
# Uses: gcloud artifacts repositories set-cleanup-policies (--policy JSON array format).
# See: https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy
#
# Projects still pushing only to gcr.io/$PROJECT_ID/ should run gcr-delete-untagged-digests.sh
# instead (see script header).

set -euo pipefail

REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
POLICY="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/infra/gcp/artifact-registry-docker-lifecycle.json"

if [[ ! -f "$POLICY" ]]; then
  echo "Missing lifecycle JSON: $POLICY" >&2
  exit 1
fi

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT" >&2
  exit 1
fi

REPOS="${AR_REPOSITORY_LIST:-}"

if [[ -z "$REPOS" ]]; then
  echo "Applying cleanup policies to Artifact Registry Docker repositories in project=${PROJECT_ID} region=${REGION}..."

  LIST_OUT=
  if ! LIST_OUT=$(gcloud artifacts repositories list \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --filter="format:DOCKER" \
    --format="value(name)" 2>/dev/null); then
    LIST_OUT=
  fi

  if [[ -z "${LIST_OUT// }" ]]; then
    echo "No Artifact Registry Docker repositories found in ${REGION}. Nothing to update."
    echo "If you only use Google Container Registry (gcr.io), use:"
    echo "  ./scripts/gcp/gcr-delete-untagged-digests.sh"
    exit 0
  fi

  while IFS= read -r FULL; do
    [[ -z "$FULL" ]] && continue
    SHORT="${FULL##*/}"
    echo "Setting cleanup policies: repository=${SHORT}"
    gcloud artifacts repositories set-cleanup-policies "${SHORT}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --policy="${POLICY}"
  done <<< "$LIST_OUT"
else
  IFS=',' read -ra LIST <<< "${REPOS}"
  for SHORT in "${LIST[@]}"; do
    SHORT="$(echo "${SHORT}" | xargs)"
    [[ -z "${SHORT}" ]] && continue
    echo "Setting cleanup policies: repository=${SHORT}"
    gcloud artifacts repositories set-cleanup-policies "${SHORT}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --policy="${POLICY}"
  done
fi

echo "Done."

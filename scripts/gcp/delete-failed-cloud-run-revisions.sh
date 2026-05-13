#!/usr/bin/env bash
# Delete Cloud Run revisions whose Ready condition is False (failed deploy / unhealthy).
# Skips revisions that still receive traffic (percent > 0). Safe to run often.
#
# Usage:
#   ./scripts/gcp/delete-failed-cloud-run-revisions.sh SERVICE_NAME [REGION] [PROJECT_ID]
#
# Requires: gcloud, jq (if jq is missing, exits 0 and prints a skip warning).

set -euo pipefail

SERVICE="${1:?usage: $0 SERVICE_NAME [REGION] [PROJECT_ID]}"
REGION="${2:-${GCP_REGION:-us-central1}}"
PROJECT="${3:-${GCP_PROJECT_ID:-dialadrink-production}}"

if ! command -v jq >/dev/null 2>&1; then
  echo "   ⚠️  jq not installed — skipping failed-revision cleanup for $SERVICE (brew install jq / apt install jq)" >&2
  exit 0
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "   ⚠️  gcloud not found — skipping failed-revision cleanup for $SERVICE" >&2
  exit 0
fi

REVS_JSON=$(gcloud run revisions list \
  --service="$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --format=json 2>/dev/null || true)
[[ -z "$REVS_JSON" || "$REVS_JSON" == null ]] && REVS_JSON='[]'

SVC_JSON=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --format=json 2>/dev/null || true)
[[ -z "$SVC_JSON" || "$SVC_JSON" == null ]] && SVC_JSON='{}'

# Revision names that currently receive traffic — never delete.
mapfile -t PROTECTED_NAMES < <(echo "$SVC_JSON" | jq -r '
  (.status.traffic // [])[]?
  | select((.percent // 0) > 0)
  | .revisionName // empty
')

protected() {
  local r="$1"
  local p
  for p in "${PROTECTED_NAMES[@]}"; do
    [[ "$p" == "$r" ]] && return 0
  done
  return 1
}

mapfile -t FAILED_REVS < <(echo "$REVS_JSON" | jq -r '
  [.[] | select(any(.status.conditions[]?; .type == "Ready" and .status == "False"))
   | .metadata.name] | .[]')

if [[ ${#FAILED_REVS[@]} -eq 0 ]]; then
  echo "   $SERVICE: no failed revisions (Ready=False)."
  exit 0
fi

deleted=0
for rev in "${FAILED_REVS[@]}"; do
  [[ -z "$rev" ]] && continue
  if protected "$rev"; then
    echo "   ⚠️  Skip failed revision $rev (still has traffic)"
    continue
  fi
  echo "   Deleting failed revision: $rev"
  if gcloud run revisions delete "$rev" \
    --region="$REGION" \
    --project="$PROJECT" \
    --quiet 2>/dev/null; then
    deleted=$((deleted + 1))
  else
    echo "   ⚠️  Could not delete revision: $rev"
  fi
done

if [[ "$deleted" -gt 0 ]]; then
  echo "   $SERVICE: removed $deleted failed revision(s)."
fi

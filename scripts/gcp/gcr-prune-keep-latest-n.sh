#!/usr/bin/env bash
# Prune Google Container Registry (gcr.io) images to keep only the latest N digests.
# Deletes BOTH tagged and untagged digests (older than the keep set).
#
# Safety notes:
# - Keeps the newest N digests by timestamp.
# - Always keeps any digest that still has a "latest" tag.
# - This is meant for CI-style timestamp/SHA tagging where the currently deployed revision
#   is among the newest tags.
#
# Usage:
#   GCP_PROJECT_ID=dialadrink-production KEEP_N=5 IMAGES="dialadrink-frontend dialadrink-admin deliveryos-production-backend" \
#     ./scripts/gcp/gcr-prune-keep-latest-n.sh
#
# Optional:
#   DRY_RUN=1 ... (prints what would be deleted)
#
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
KEEP_N="${KEEP_N:-5}"
DRY_RUN="${DRY_RUN:-0}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or: gcloud config set project YOUR_PROJECT" >&2
  exit 1
fi

if ! [[ "${KEEP_N}" =~ ^[0-9]+$ ]] || [[ "${KEEP_N}" -lt 1 ]]; then
  echo "KEEP_N must be a positive integer (got: ${KEEP_N})" >&2
  exit 1
fi

if [[ -z "${IMAGES:-}" ]]; then
  echo "Set IMAGES to a space-separated list of gcr.io image names." >&2
  echo "Example: IMAGES=\"dialadrink-frontend dialadrink-admin deliveryos-production-backend\"" >&2
  exit 1
fi

for NAME in ${IMAGES}; do
  IMG="gcr.io/${PROJECT_ID}/${NAME}"
  echo "=== ${IMG} (keep latest ${KEEP_N}) ==="

  if ! gcloud container images describe "${IMG}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  (skip: image path not found)"
    continue
  fi

  JSON="$(gcloud container images list-tags "${IMG}" \
    --project="${PROJECT_ID}" \
    --limit=9999 \
    --sort-by=~timestamp \
    --format=json 2>/dev/null || echo "[]")"

  python3 - <<'PY' "${IMG}" "${PROJECT_ID}" "${KEEP_N}" "${DRY_RUN}" "${JSON}"
import json, sys, subprocess

img, project_id, keep_n_s, dry_run_s, raw = sys.argv[1:6]
keep_n = int(keep_n_s)
dry_run = dry_run_s == "1"

try:
    rows = json.loads(raw)
except Exception:
    rows = []

def tags_of(row):
    t = row.get("tags") or []
    # gcloud sometimes returns a comma-separated string in older versions; normalize
    if isinstance(t, str):
        t = [x.strip() for x in t.split(",") if x.strip()]
    return t

digests_in_order = []
digest_to_tags = {}
for r in rows:
    d = (r.get("digest") or "").strip()
    if not d:
        continue
    if d not in digest_to_tags:
        digests_in_order.append(d)
        digest_to_tags[d] = set()
    for t in tags_of(r):
        digest_to_tags[d].add(t)

keep = set(digests_in_order[:keep_n])
for d, tags in digest_to_tags.items():
    if "latest" in tags:
        keep.add(d)

to_delete = [d for d in digests_in_order if d not in keep]

if not digests_in_order:
    print("  (no digests found)")
    sys.exit(0)

print(f"  digests found: {len(digests_in_order)}")
print(f"  keep: {len(keep)} (newest {keep_n} + any tagged 'latest')")
print(f"  delete: {len(to_delete)}")

for d in to_delete:
    ref = f"{img}@{d}"
    if dry_run:
        print(f"  DRY_RUN delete {ref}")
        continue
    print(f"  delete {ref}")
    # --force-delete-tags ensures tagged manifests get deleted too
    subprocess.run(
        ["gcloud", "container", "images", "delete", ref, "--project", project_id, "--quiet", "--force-delete-tags"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
PY
done

echo "Done."


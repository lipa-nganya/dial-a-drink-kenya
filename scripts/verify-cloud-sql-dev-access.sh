#!/usr/bin/env bash
# Verify and fix Cloud SQL dev access for the identity in application_default_credentials.json.
# Ensures: (1) ADC identity has Cloud SQL Client, (2) if IAM DB auth is on, identity can log in,
#          (3) DB user/password are documented and connection path is open via proxy.
#
# Run: ./scripts/verify-cloud-sql-dev-access.sh
# Optional: --fix to add missing IAM bindings (default is check-only).

set -e
FIX=false
for arg in "$@"; do
  [ "$arg" = "--fix" ] && FIX=true && break
done

PROJECT="dialadrink-production"
INSTANCE="dialadrink-db-dev"
DB_USER="dialadrink_app"

echo "🔐 Cloud SQL dev access verification"
echo "   Project: $PROJECT  Instance: $INSTANCE"
echo "=========================================="

# 1) Get ADC identity (user or service account)
ADC_FILE="${HOME}/.config/gcloud/application_default_credentials.json"
if [ ! -f "$ADC_FILE" ]; then
  echo "❌ No application_default_credentials.json. Run: gcloud auth application-default login"
  exit 1
fi

ADC_TYPE=$(python3 -c "import json; d=json.load(open('$ADC_FILE')); print(d.get('type',''))")
if [ "$ADC_TYPE" = "service_account" ]; then
  PRINCIPAL=$(python3 -c "import json; d=json.load(open('$ADC_FILE')); print(d.get('client_email',''))")
  if [ -z "$PRINCIPAL" ]; then
    echo "❌ Could not read client_email from ADC"
    exit 1
  fi
  MEMBER="serviceAccount:${PRINCIPAL}"
elif [ "$ADC_TYPE" = "authorized_user" ]; then
  USER_EMAIL=$(gcloud config get account 2>/dev/null || true)
  if [ -z "$USER_EMAIL" ]; then
    echo "❌ Could not get gcloud account (ADC is user-based). Run: gcloud auth login"
    exit 1
  fi
  PRINCIPAL="$USER_EMAIL"
  MEMBER="user:${USER_EMAIL}"
else
  echo "❌ Unknown ADC type: $ADC_TYPE"
  exit 1
fi

echo ""
echo "1️⃣  ADC identity (used by Cloud SQL Proxy)"
echo "   $PRINCIPAL"
echo "   (member: $MEMBER)"
echo ""

# 2) Cloud SQL Client + Viewer roles (proxy needs both: Client to connect, Viewer for instances.get metadata)
echo "2️⃣  Cloud SQL Client role (proxy needs this to connect)"
HAS_CLIENT=false
gcloud projects get-iam-policy "$PROJECT" --format="json" 2>/dev/null | \
  CHECK_MEMBER="$MEMBER" CHECK_PRINCIPAL="$PRINCIPAL" python3 -c "
import json, sys, os
member = os.environ.get('CHECK_MEMBER', '')
principal = os.environ.get('CHECK_PRINCIPAL', '')
data = json.load(sys.stdin)
for b in data.get('bindings', []):
  if b.get('role') == 'roles/cloudsql.client':
    for m in b.get('members', []):
      if m == member or principal in m:
        sys.exit(0)
sys.exit(1)
" 2>/dev/null && HAS_CLIENT=true

if [ "$HAS_CLIENT" = true ]; then
  echo "   ✅ $MEMBER has roles/cloudsql.client"
else
  echo "   ❌ $MEMBER does NOT have roles/cloudsql.client"
  if [ "$FIX" = true ]; then
    echo "   Granting roles/cloudsql.client..."
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="$MEMBER" \
      --role="roles/cloudsql.client" \
      --condition=None \
      --quiet
    echo "   ✅ Granted."
  else
    echo "   Run with --fix to grant: gcloud projects add-iam-policy-binding $PROJECT --member=$MEMBER --role=roles/cloudsql.client"
  fi
fi

echo "   Cloud SQL Viewer role (proxy needs cloudsql.instances.get for instance metadata)"
HAS_VIEWER=false
gcloud projects get-iam-policy "$PROJECT" --format="json" 2>/dev/null | \
  CHECK_MEMBER="$MEMBER" CHECK_PRINCIPAL="$PRINCIPAL" python3 -c "
import json, sys, os
member = os.environ.get('CHECK_MEMBER', '')
principal = os.environ.get('CHECK_PRINCIPAL', '')
data = json.load(sys.stdin)
for b in data.get('bindings', []):
  if b.get('role') == 'roles/cloudsql.viewer':
    for m in b.get('members', []):
      if m == member or principal in m:
        sys.exit(0)
sys.exit(1)
" 2>/dev/null && HAS_VIEWER=true

if [ "$HAS_VIEWER" = true ]; then
  echo "   ✅ $MEMBER has roles/cloudsql.viewer"
else
  echo "   ❌ $MEMBER does NOT have roles/cloudsql.viewer"
  if [ "$FIX" = true ]; then
    echo "   Granting roles/cloudsql.viewer..."
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="$MEMBER" \
      --role="roles/cloudsql.viewer" \
      --condition=None \
      --quiet
    echo "   ✅ Granted."
  else
    echo "   Run with --fix to grant (proxy needs cloudsql.instances.get)."
  fi
fi
echo ""

# 3) IAM database authentication (PostgreSQL)
echo "3️⃣  IAM database authentication (instance-level)"
FLAGS=$(gcloud sql instances describe "$INSTANCE" --project="$PROJECT" --format="json" 2>/dev/null | python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  flags = d.get('settings', {}).get('databaseFlags', [])
  for f in flags:
    if f.get('name') == 'cloudsql.iam_authentication':
      print(f.get('value', ''))
      break
except Exception:
  pass
" 2>/dev/null || true)

if [ "$FLAGS" = "on" ]; then
  echo "   IAM DB auth is ON. Checking roles/cloudsql.instanceUser..."
  HAS_INSTANCE_USER=false
  gcloud projects get-iam-policy "$PROJECT" --format="json" 2>/dev/null | \
    CHECK_MEMBER="$MEMBER" CHECK_PRINCIPAL="$PRINCIPAL" python3 -c "
import json, sys, os
member = os.environ.get('CHECK_MEMBER', '')
principal = os.environ.get('CHECK_PRINCIPAL', '')
data = json.load(sys.stdin)
for b in data.get('bindings', []):
  if b.get('role') == 'roles/cloudsql.instanceUser':
    for m in b.get('members', []):
      if m == member or principal in m:
        sys.exit(0)
sys.exit(1)
" 2>/dev/null && HAS_INSTANCE_USER=true

  if [ "$HAS_INSTANCE_USER" = true ]; then
    echo "   ✅ $MEMBER has roles/cloudsql.instanceUser (can log in to DB via IAM)"
  else
    echo "   ❌ $MEMBER does NOT have roles/cloudsql.instanceUser"
    if [ "$FIX" = true ]; then
      echo "   Granting roles/cloudsql.instanceUser..."
      gcloud projects add-iam-policy-binding "$PROJECT" \
        --member="$MEMBER" \
        --role="roles/cloudsql.instanceUser" \
        --condition=None \
        --quiet
      echo "   ✅ Granted."
    else
      echo "   Run with --fix to grant (needed if you use IAM DB login)."
    fi
  fi
else
  echo "   IAM DB auth is OFF (using password auth). No instanceUser needed for dialadrink_app."
fi
echo ""

# 4) DB user/password and proxy
echo "4️⃣  DB user and proxy"
echo "   User: $DB_USER (password in DATABASE_URL / DATABASE_CREDENTIALS.md)"
echo "   Cloud Run dev backend DATABASE_URL user should be $DB_USER."
echo "   To confirm password: GCP Console → SQL → $INSTANCE → Users, or reset:"
echo "   gcloud sql users set-password $DB_USER --instance=$INSTANCE --project=$PROJECT"
echo "   Connections through Cloud SQL Proxy do not use authorized networks; proxy uses IAM (Cloud SQL Client)."
echo ""

echo "=========================================="
echo "Done. If connection still fails, run with --fix then retry migrations."
echo "  ./scripts/verify-cloud-sql-dev-access.sh --fix"

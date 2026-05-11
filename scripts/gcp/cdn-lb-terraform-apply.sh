#!/usr/bin/env bash
# Plan/apply the Cloud CDN + HTTPS load balancer in infra/gcp/cdn-lb.
#
# Prerequisites:
#   - terraform >= 1.5 installed
#   - gcloud auth application-default login (or GOOGLE_APPLICATION_CREDENTIALS)
#   - Copy infra/gcp/cdn-lb/terraform.tfvars.example → terraform.tfvars and edit hostnames
#
# Usage:
#   ./scripts/gcp/cdn-lb-terraform-apply.sh plan
#   ./scripts/gcp/cdn-lb-terraform-apply.sh apply

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/infra/gcp/cdn-lb"

if ! command -v terraform >/dev/null 2>&1; then
  echo "Install Terraform (>= 1.5): https://developer.hashicorp.com/terraform/install"
  exit 1
fi

if [[ ! -f terraform.tfvars ]]; then
  echo "Create $ROOT/infra/gcp/cdn-lb/terraform.tfvars from terraform.tfvars.example"
  exit 1
fi

MODE="${1:-plan}"
terraform init -input=false
if [[ "$MODE" == "apply" ]]; then
  terraform apply -input=false -var-file=terraform.tfvars
elif [[ "$MODE" == "plan" ]]; then
  terraform plan -input=false -var-file=terraform.tfvars
else
  echo "Usage: $0 plan|apply"
  exit 1
fi

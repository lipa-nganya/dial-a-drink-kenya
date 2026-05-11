# Cloud CDN in front of production Cloud Run (GCP)

Cloud Run’s default `*.run.app` URLs **cannot** attach Cloud CDN directly. This stack creates:

- A **global external Application Load Balancer** (HTTPS)
- **Serverless NEGs** pointing at your three production Cloud Run services
- **Cloud CDN** on each backend service (`USE_ORIGIN_HEADERS` so your existing `Cache-Control` headers drive caching)

**Current intended rollout**

The Terraform variables are currently set up for a **Ruaka-only dry run**. Keep the primary
`dialadrinkkenya.com` domains on Cloud Run domain mappings until the Ruaka cutover has been
tested end-to-end.

**Routing**

- Hostnames in `cdn_api_hosts` → `deliveryos-production-backend`
- Hostnames in `cdn_admin_hosts` → `deliveryos-admin-frontend`
- Any other request host (including all `cdn_customer_hosts`) → **default** → `deliveryos-customer-frontend`

Put **all** customer-facing names (apex + `www`) in `cdn_customer_hosts` so they appear on the **managed SSL certificate**.

**Not included:** `deliveryos-development-backend` (keep dev on `*.run.app` or add a second small stack). **Not included:** HTTP→HTTPS redirect on port 80 (add later if needed).

## Steps

1. Install [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5.

2. Copy and edit variables:

   ```bash
   cp infra/gcp/cdn-lb/terraform.tfvars.example infra/gcp/cdn-lb/terraform.tfvars
   # Set real hostnames for api / customer / admin
   ```

3. Plan and apply:

   ```bash
   ./scripts/gcp/cdn-lb-terraform-apply.sh plan
   ./scripts/gcp/cdn-lb-terraform-apply.sh apply
   ```

4. Take the **`load_balancer_ip`** output and create **DNS A records** for every hostname in the certificate (all three lists) pointing at that IP.

5. Wait for **managed SSL provisioning** (often 15–60 minutes after DNS is correct).

6. For the Ruaka dry run, point apps/test traffic at the Ruaka API hostname only after the LB certificate is ACTIVE. Do not point Dial A Drink production builds at the CDN API until a later planned cutover.

## Destroy

```bash
cd infra/gcp/cdn-lb && terraform destroy -var-file=terraform.tfvars
```

## Cost note

A global external HTTPS load balancer and CDN have **baseline GCP charges** in addition to Cloud Run. Review current GCP pricing before leaving this running.

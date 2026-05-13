# Production CDN + LB module is idle (no hostnames → terraform creates nothing).
# Ruaka was cut back to Cloud Run domain mappings in May 2026; do not point Ruaka DNS at a
# global LB IP unless you intentionally fill cdn_* lists and apply again.
project_id = "dialadrink-production"
region     = "us-central1"

api_cloud_run_service      = "deliveryos-production-backend"
customer_cloud_run_service = "deliveryos-customer-frontend"
admin_cloud_run_service    = "deliveryos-admin-frontend"

cdn_api_hosts      = []
cdn_customer_hosts = []
cdn_admin_hosts    = []

cdn_cache_mode = "USE_ORIGIN_HEADERS"

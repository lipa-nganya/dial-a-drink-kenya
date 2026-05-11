# Production CDN + LB (committed for automation; rotate via PR if hostnames change)
project_id = "dialadrink-production"
region     = "us-central1"

api_cloud_run_service      = "deliveryos-production-backend"
customer_cloud_run_service = "deliveryos-customer-frontend"
admin_cloud_run_service    = "deliveryos-admin-frontend"

# Dry-run CDN hostnames only. Keep primary Dial A Drink domains on Cloud Run domain mappings
# until the Ruaka cutover has been tested end-to-end.
cdn_api_hosts = [
  "api.ruakadrinksdelivery.co.ke",
]

cdn_customer_hosts = [
  "ruakadrinksdelivery.co.ke",
  "www.ruakadrinksdelivery.co.ke",
]

cdn_admin_hosts = [
  "admin.ruakadrinksdelivery.co.ke",
  "www.admin.ruakadrinksdelivery.co.ke",
]

cdn_cache_mode = "USE_ORIGIN_HEADERS"

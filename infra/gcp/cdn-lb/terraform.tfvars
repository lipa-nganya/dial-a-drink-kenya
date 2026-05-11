# Production CDN + LB (committed for automation; rotate via PR if hostnames change)
project_id = "dialadrink-production"
region     = "us-central1"

api_cloud_run_service      = "deliveryos-production-backend"
customer_cloud_run_service = "deliveryos-customer-frontend"
admin_cloud_run_service    = "deliveryos-admin-frontend"

# API on dedicated subdomain (CDN + SSL). Customer/admin use existing site hostnames.
cdn_api_hosts = [
  "api.dialadrinkkenya.com",
]

cdn_customer_hosts = [
  "dialadrinkkenya.com",
  "www.dialadrinkkenya.com",
  "ruakadrinksdelivery.co.ke",
  "www.ruakadrinksdelivery.co.ke",
]

cdn_admin_hosts = [
  "admin.dialadrinkkenya.com",
  "www.admin.dialadrinkkenya.com",
  "admin.ruakadrinksdelivery.co.ke",
  "www.admin.ruakadrinksdelivery.co.ke",
]

cdn_cache_mode = "USE_ORIGIN_HEADERS"

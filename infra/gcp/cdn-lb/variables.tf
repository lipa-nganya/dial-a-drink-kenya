variable "project_id" {
  type        = string
  description = "GCP project id (e.g. dialadrink-production)"
}

variable "region" {
  type        = string
  description = "Cloud Run region for serverless NEGs"
  default     = "us-central1"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for LB resource names"
  default     = "dialadrink-cdn"
}

variable "api_cloud_run_service" {
  type        = string
  description = "Production API Cloud Run service name"
  default     = "deliveryos-production-backend"
}

variable "customer_cloud_run_service" {
  type        = string
  description = "Production customer frontend Cloud Run service name"
  default     = "deliveryos-customer-frontend"
}

variable "admin_cloud_run_service" {
  type        = string
  description = "Production admin frontend Cloud Run service name"
  default     = "deliveryos-admin-frontend"
}

variable "cdn_api_hosts" {
  type        = list(string)
  description = "Hostnames for API (HTTPS). DNS A/AAAA must point to LB IP after apply."
  default     = []
}

variable "cdn_customer_hosts" {
  type        = list(string)
  description = "Hostnames for customer site (default backend)."
  default     = []
}

variable "cdn_admin_hosts" {
  type        = list(string)
  description = "Hostnames for admin site."
  default     = []
}

variable "cdn_cache_mode" {
  type        = string
  description = "Cloud CDN cache mode. USE_ORIGIN_HEADERS respects Cache-Control from Cloud Run."
  default     = "USE_ORIGIN_HEADERS"

  validation {
    condition = contains([
      "USE_ORIGIN_HEADERS",
      "CACHE_ALL_STATIC",
      "FORCE_CACHE_ALL",
      "EDGE_UNCACHEABLE"
    ], var.cdn_cache_mode)
    error_message = "cdn_cache_mode must be a supported Cloud CDN cache mode."
  }
}

# When all cdn_* host lists are empty, no load balancer resources are created (safe idle state).

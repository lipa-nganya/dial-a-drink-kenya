locals {
  all_hosts = concat(var.cdn_api_hosts, var.cdn_customer_hosts, var.cdn_admin_hosts)
  # Host-based routing: API and admin get explicit matchers; everything else uses default (customer).
  route_entries = concat(
    length(var.cdn_api_hosts) > 0 ? [{
      name    = "api"
      hosts   = var.cdn_api_hosts
      backend = google_compute_backend_service.api.id
    }] : [],
    length(var.cdn_admin_hosts) > 0 ? [{
      name    = "admin"
      hosts   = var.cdn_admin_hosts
      backend = google_compute_backend_service.admin.id
    }] : []
  )
}

check "at_least_one_hostname" {
  assert {
    condition     = length(local.all_hosts) > 0
    error_message = "Set at least one hostname across cdn_api_hosts, cdn_customer_hosts, and cdn_admin_hosts (SSL + HTTPS forwarding require real DNS names)."
  }
}

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

# --- Serverless NEGs (one per Cloud Run service) ---

resource "google_compute_region_network_endpoint_group" "api" {
  name                  = "${var.name_prefix}-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.api_cloud_run_service
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_region_network_endpoint_group" "customer" {
  name                  = "${var.name_prefix}-customer-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.customer_cloud_run_service
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_region_network_endpoint_group" "admin" {
  name                  = "${var.name_prefix}-admin-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.admin_cloud_run_service
  }

  depends_on = [google_project_service.compute]
}

# --- Backend services + Cloud CDN ---

resource "google_compute_backend_service" "api" {
  name                  = "${var.name_prefix}-api-bs"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  enable_cdn            = true

  cdn_policy {
    cache_mode                   = var.cdn_cache_mode
    signed_url_cache_max_age_sec = 0
  }

  backend {
    group           = google_compute_region_network_endpoint_group.api.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_backend_service" "customer" {
  name                  = "${var.name_prefix}-customer-bs"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  enable_cdn            = true

  cdn_policy {
    cache_mode                   = var.cdn_cache_mode
    signed_url_cache_max_age_sec = 0
  }

  backend {
    group           = google_compute_region_network_endpoint_group.customer.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_backend_service" "admin" {
  name                  = "${var.name_prefix}-admin-bs"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  enable_cdn            = true

  cdn_policy {
    cache_mode                   = var.cdn_cache_mode
    signed_url_cache_max_age_sec = 0
  }

  backend {
    group           = google_compute_region_network_endpoint_group.admin.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  depends_on = [google_project_service.compute]
}

# --- Global static IP + URL map + HTTPS proxy ---

resource "google_compute_global_address" "cdn" {
  name = "${var.name_prefix}-ip"

  depends_on = [google_project_service.compute]
}

resource "google_compute_managed_ssl_certificate" "cdn" {
  count = length(local.all_hosts) > 0 ? 1 : 0
  name  = "${var.name_prefix}-cert"

  managed {
    domains = local.all_hosts
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_url_map" "cdn" {
  name            = "${var.name_prefix}-urlmap"
  default_service = google_compute_backend_service.customer.id

  dynamic "host_rule" {
    for_each = local.route_entries
    content {
      hosts        = host_rule.value.hosts
      path_matcher = host_rule.value.name
    }
  }

  dynamic "path_matcher" {
    for_each = local.route_entries
    content {
      name            = path_matcher.value.name
      default_service = path_matcher.value.backend
    }
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_target_https_proxy" "cdn" {
  count = length(local.all_hosts) > 0 ? 1 : 0
  name  = "${var.name_prefix}-https-proxy"
  url_map = google_compute_url_map.cdn.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.cdn[0].id
  ]

  depends_on = [google_project_service.compute]
}

resource "google_compute_global_forwarding_rule" "https" {
  count      = length(local.all_hosts) > 0 ? 1 : 0
  name       = "${var.name_prefix}-https-fr"
  target     = google_compute_target_https_proxy.cdn[0].id
  port_range = "443"
  ip_address = google_compute_global_address.cdn.address

  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [google_project_service.compute]
}

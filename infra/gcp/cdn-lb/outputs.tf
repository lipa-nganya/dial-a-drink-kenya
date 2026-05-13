output "load_balancer_ip" {
  description = "Reserve this IPv4 in DNS (A records) for all hostnames on the managed certificate."
  value       = try(google_compute_global_address.cdn[0].address, null)
}

output "https_forwarding_rule" {
  description = "Global HTTPS forwarding rule name (port 443)."
  value       = try(google_compute_global_forwarding_rule.https[0].name, null)
}

output "backend_services" {
  value = local.lb_enabled ? {
    api      = google_compute_backend_service.api[0].name
    customer = google_compute_backend_service.customer[0].name
    admin    = google_compute_backend_service.admin[0].name
  } : null
}

output "ssl_certificate_status" {
  description = "After DNS points to the LB IP, provisioning can take 15–60 minutes."
  value       = try(google_compute_managed_ssl_certificate.cdn[0].id, null)
}

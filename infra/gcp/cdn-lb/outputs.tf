output "load_balancer_ip" {
  description = "Reserve this IPv4 in DNS (A records) for all hostnames on the managed certificate."
  value       = google_compute_global_address.cdn.address
}

output "https_forwarding_rule" {
  description = "Global HTTPS forwarding rule name (port 443)."
  value       = try(google_compute_global_forwarding_rule.https[0].name, null)
}

output "backend_services" {
  value = {
    api      = google_compute_backend_service.api.name
    customer = google_compute_backend_service.customer.name
    admin    = google_compute_backend_service.admin.name
  }
}

output "ssl_certificate_status" {
  description = "After DNS points to the LB IP, provisioning can take 15–60 minutes."
  value       = try(google_compute_managed_ssl_certificate.cdn[0].id, null)
}

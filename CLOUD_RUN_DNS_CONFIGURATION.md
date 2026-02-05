# Cloud Run DNS Configuration Guide

## Overview
This guide explains how to point production domains from Netlify to Google Cloud Run:
- **Customer Frontend**: `ruakadrinksdelivery.co.ke`
- **Admin Frontend**: `admin.ruakadrinksdelivery.co.ke`

---

## Step 1: Deploy Frontends to Cloud Run

Deploy both frontends to Cloud Run:

### Customer Frontend
```bash
./deploy-frontend-production.sh
```

This will create a Cloud Run service at:
```
https://deliveryos-customer-frontend-[hash].us-central1.run.app
```

### Admin Frontend
```bash
./deploy-admin-production.sh
```

This will create a Cloud Run service at:
```
https://deliveryos-admin-frontend-[hash].us-central1.run.app
```

---

## Step 2: Create Domain Mappings in Cloud Run

### Customer Frontend Domain Mapping

Map the customer domain to the Cloud Run service:

```bash
gcloud run domain-mappings create \
  --service deliveryos-customer-frontend \
  --domain ruakadrinksdelivery.co.ke \
  --domain www.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production
```

### Admin Frontend Domain Mapping

Map the admin domain to the Cloud Run service:

```bash
gcloud run domain-mappings create \
  --service deliveryos-admin-frontend \
  --domain admin.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production
```

**Note:** These commands will fail if the domains are already mapped elsewhere. You may need to remove them from Netlify first.

---

## Step 3: Get DNS Records from Cloud Run

After creating the domain mappings, get the DNS records for each domain:

### Customer Frontend DNS Records

```bash
gcloud run domain-mappings describe ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production \
  --format="value(status.resourceRecords)"
```

### Admin Frontend DNS Records

```bash
gcloud run domain-mappings describe admin.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production \
  --format="value(status.resourceRecords)"
```

Or view in the Cloud Console:
1. Go to [Cloud Run Domain Mappings](https://console.cloud.google.com/run/domains)
2. Click on each domain
3. View the **DNS records** section

You'll see records like:
```
Type: A
Name: @ (for root domain) or admin (for subdomain)
Value: 34.102.136.180

Type: AAAA
Name: @ (for root domain) or admin (for subdomain)
Value: 2600:1901:0:1234::5

Type: CNAME
Name: www (only for root domain)
Value: ghs.googlehosted.com
```

---

## Step 4: Update DNS Records at Your DNS Provider

### Option A: Using HostAfrica (or similar)

1. **Login to HostAfrica:**
   - Go to https://my.hostafrica.com
   - Login with your credentials

2. **Navigate to DNS Management:**
   - Find `ruakadrinksdelivery.co.ke`
   - Go to **DNS Management** or **DNS Records**

3. **Remove old Netlify records** (if any):
   - Delete any CNAME records pointing to Netlify
   - Delete any A records pointing to Netlify IPs

4. **Add Cloud Run DNS records:**

   **For Customer Frontend (root domain `@` or `ruakadrinksdelivery.co.ke`):**
   ```
   Type: A
   Host/Name: @
   Value: [IP from Cloud Run domain mapping for ruakadrinksdelivery.co.ke]
   TTL: 3600
   ```

   **For Customer Frontend IPv6 (if provided):**
   ```
   Type: AAAA
   Host/Name: @
   Value: [IPv6 from Cloud Run domain mapping for ruakadrinksdelivery.co.ke]
   TTL: 3600
   ```

   **For Customer Frontend www subdomain:**
   ```
   Type: CNAME
   Host/Name: www
   Value: ghs.googlehosted.com
   TTL: 3600
   ```

   **For Admin Frontend (subdomain `admin`):**
   ```
   Type: A
   Host/Name: admin
   Value: [IP from Cloud Run domain mapping for admin.ruakadrinksdelivery.co.ke]
   TTL: 3600
   ```

   **For Admin Frontend IPv6 (if provided):**
   ```
   Type: AAAA
   Host/Name: admin
   Value: [IPv6 from Cloud Run domain mapping for admin.ruakadrinksdelivery.co.ke]
   TTL: 3600
   ```

### Option B: Using Google Cloud DNS (Recommended)

If you want to manage DNS in Google Cloud:

1. **Create a DNS zone:**
   ```bash
   gcloud dns managed-zones create ruakadrinksdelivery-zone \
     --dns-name=ruakadrinksdelivery.co.ke \
     --description="DNS zone for ruakadrinksdelivery.co.ke" \
     --project dialadrink-production
   ```

2. **Get nameservers:**
   ```bash
   gcloud dns managed-zones describe ruakadrinksdelivery-zone \
     --project dialadrink-production \
     --format="value(nameServers)"
   ```

3. **Update nameservers at domain registrar:**
   - Go to your domain registrar (where you bought `ruakadrinksdelivery.co.ke`)
   - Update nameservers to the ones from step 2

4. **Add DNS records:**
   - The Cloud Run domain mapping will automatically create the records
   - Or manually add them using `gcloud dns record-sets transaction`

---

## Step 5: Verify DNS Propagation

Wait 5-15 minutes for DNS to propagate, then verify:

```bash
# Check A record
dig ruakadrinksdelivery.co.ke +short

# Check CNAME for www
dig www.ruakadrinksdelivery.co.ke +short

# Check domain mapping status
gcloud run domain-mappings describe ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production
```

The domain mapping status should show `ACTIVE` when DNS is properly configured.

---

## Step 6: Remove Domains from Netlify

Once Cloud Run is serving both sites:

1. **Go to Netlify Dashboard:**
   - Login at https://app.netlify.com
   - Find the customer frontend site with `ruakadrinksdelivery.co.ke`
   - Find the admin frontend site (if it has a custom domain)

2. **Remove custom domains:**
   - **Customer Frontend**: Go to **Site settings** → **Domain management**
     - Remove `ruakadrinksdelivery.co.ke` and `www.ruakadrinksdelivery.co.ke`
   - **Admin Frontend**: Go to **Site settings** → **Domain management**
     - Remove `admin.ruakadrinksdelivery.co.ke` (if it was configured)
   - This will free up the domains for Cloud Run

---

## Troubleshooting

### Domain mapping shows "Pending" or "Failed"

- **Check DNS records:** Make sure A/CNAME records are correctly set
- **Wait for propagation:** DNS changes can take up to 48 hours (usually 5-15 minutes)
- **Verify records:** Use `dig` or `nslookup` to confirm records are correct

### SSL Certificate Issues

- Cloud Run automatically provisions SSL certificates via Let's Encrypt
- This can take 15-60 minutes after DNS is configured
- Check certificate status in Cloud Console → Cloud Run → Domain Mappings

### Site shows "Not Found" or 404

- Verify the Cloud Run service is deployed and running
- Check that the service name matches: `deliveryos-customer-frontend`
- Verify the service URL is accessible

### DNS Propagation Delays

- Use different DNS servers to check: `8.8.8.8` (Google), `1.1.1.1` (Cloudflare)
- Clear browser cache and try incognito mode
- Wait up to 48 hours for full global propagation

---

## Quick Reference Commands

```bash
# Deploy frontends
./deploy-frontend-production.sh
./deploy-admin-production.sh

# Create domain mappings
# Customer frontend
gcloud run domain-mappings create \
  --service deliveryos-customer-frontend \
  --domain ruakadrinksdelivery.co.ke \
  --domain www.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production

# Admin frontend
gcloud run domain-mappings create \
  --service deliveryos-admin-frontend \
  --domain admin.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production

# Check domain mapping status
gcloud run domain-mappings describe ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production

gcloud run domain-mappings describe admin.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production

# List all domain mappings
gcloud run domain-mappings list \
  --region us-central1 \
  --project dialadrink-production

# Delete domain mappings (if needed)
gcloud run domain-mappings delete ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production

gcloud run domain-mappings delete admin.ruakadrinksdelivery.co.ke \
  --region us-central1 \
  --project dialadrink-production
```

---

## Important Notes

1. **Domain ownership:** Cloud Run will verify domain ownership via DNS records
2. **SSL certificates:** Automatically provisioned, no manual configuration needed
3. **Cost:** Cloud Run domain mappings are free, but you pay for Cloud Run service usage
4. **Multiple domains:** You can map multiple domains to the same Cloud Run service
5. **Subdomains:** Each subdomain needs its own domain mapping or CNAME record

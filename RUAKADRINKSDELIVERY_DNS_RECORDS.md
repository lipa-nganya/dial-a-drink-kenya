# DNS Records for ruakadrinksdelivery.co.ke

## Current Status
- ✅ Domain verified in Google Cloud
- ✅ Domain mapping created: `ruakadrinksdelivery.co.ke` → `deliveryos-customer-frontend`
- ✅ Domain mapping created: `www.ruakadrinksdelivery.co.ke` → `deliveryos-customer-frontend`
- ✅ SSL certificates provisioned
- ⚠️ **DNS records need to be added at DNS provider**

## Required DNS Records

### For Root Domain (`ruakadrinksdelivery.co.ke`)

**Add these A records at your DNS provider:**

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| A | @ | 216.239.32.21 | 3600 |
| A | @ | 216.239.34.21 | 3600 |
| A | @ | 216.239.36.21 | 3600 |
| A | @ | 216.239.38.21 | 3600 |

**Add these AAAA records (IPv6) at your DNS provider:**

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| AAAA | @ | 2001:4860:4802:32::15 | 3600 |
| AAAA | @ | 2001:4860:4802:34::15 | 3600 |
| AAAA | @ | 2001:4860:4802:36::15 | 3600 |
| AAAA | @ | 2001:4860:4802:38::15 | 3600 |

### For WWW Subdomain (`www.ruakadrinksdelivery.co.ke`)

**Add this CNAME record at your DNS provider:**

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| CNAME | www | ghs.googlehosted.com | 3600 |

## How to Add DNS Records

### If using HostAfrica:

1. **Login to HostAfrica:**
   - Go to https://my.hostafrica.com
   - Login with your credentials

2. **Navigate to DNS Management:**
   - Find `ruakadrinksdelivery.co.ke` in your domains
   - Click on **DNS Management** or **Manage DNS**

3. **Delete old records (if any):**
   - Remove any existing A records pointing to old IPs
   - Remove any CNAME records for `@` (root domain)

4. **Add new A records:**
   - Click **Add Record**
   - Type: **A**
   - Host/Name: **@** (or leave blank, or `ruakadrinksdelivery.co.ke`)
   - Value: **216.239.32.21**
   - TTL: **3600**
   - Repeat for all 4 A record values

5. **Add AAAA records (optional but recommended):**
   - Click **Add Record**
   - Type: **AAAA**
   - Host/Name: **@**
   - Value: **2001:4860:4802:32::15**
   - TTL: **3600**
   - Repeat for all 4 AAAA record values

6. **Add CNAME for www:**
   - Click **Add Record**
   - Type: **CNAME**
   - Host/Name: **www**
   - Value: **ghs.googlehosted.com**
   - TTL: **3600**

### Important Notes:

- **Root domain (`@`) MUST use A records**, not CNAME
- **www subdomain uses CNAME** pointing to `ghs.googlehosted.com`
- You need to add **all 4 A records** (Google uses multiple IPs for load balancing)
- DNS propagation can take **5-15 minutes** (sometimes up to 48 hours)
- After adding DNS records, wait for propagation before testing

## Verify DNS Configuration

After adding the records, verify they're correct:

```bash
# Check A records for root domain
dig ruakadrinksdelivery.co.ke +short

# Should return:
# 216.239.32.21
# 216.239.34.21
# 216.239.36.21
# 216.239.38.21

# Check CNAME for www
dig www.ruakadrinksdelivery.co.ke +short

# Should return:
# ghs.googlehosted.com.
```

## Troubleshooting

### "Site cannot be reached" error:

1. **Check if DNS records are added:**
   - Verify A records exist at your DNS provider
   - Make sure they point to the correct IPs (216.239.32.21, etc.)

2. **Wait for DNS propagation:**
   - DNS changes can take 5-15 minutes to propagate
   - Use different DNS servers to check: `8.8.8.8` (Google), `1.1.1.1` (Cloudflare)

3. **Clear browser cache:**
   - Try incognito/private browsing mode
   - Clear DNS cache: `sudo dscacheutil -flushcache` (macOS)

4. **Check domain mapping status:**
   ```bash
   gcloud beta run domain-mappings list \
     --region us-central1 \
     --project dialadrink-production
   ```

### SSL Certificate Issues:

- Google Cloud automatically provisions SSL certificates
- Certificate provisioning starts after DNS records are configured
- This can take 15-60 minutes after DNS is correct
- Check certificate status in Cloud Console → Cloud Run → Domain Mappings

## Current Cloud Run Service

- **Service:** `deliveryos-customer-frontend`
- **Service URL:** `https://deliveryos-customer-frontend-lssctajjoq-uc.a.run.app`
- **Region:** `us-central1`
- **Project:** `dialadrink-production`

Once DNS records are added and propagated, `https://ruakadrinksdelivery.co.ke` will serve your customer frontend from Cloud Run.

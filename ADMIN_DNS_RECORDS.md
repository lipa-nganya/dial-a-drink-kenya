# DNS Records for Admin Subdomain

## Domain Mappings Created

✅ `admin.ruakadrinksdelivery.co.ke` → `deliveryos-admin-frontend`
✅ `www.admin.ruakadrinksdelivery.co.ke` → `deliveryos-admin-frontend`

## Required DNS Records

### For `admin.ruakadrinksdelivery.co.ke` (admin subdomain)

**CNAME Record:**
- **Name:** `admin`
- **Type:** `CNAME`
- **Value:** `ghs.googlehosted.com.`
- **TTL:** 3600 (or your provider's default)

**Note:** Subdomains can use CNAME records, unlike the root domain which requires A records.

### For `www.admin.ruakadrinksdelivery.co.ke` (www.admin subdomain)

**CNAME Record:**
- **Name:** `www.admin`
- **Type:** `CNAME`
- **Value:** `ghs.googlehosted.com.`
- **TTL:** 3600 (or your provider's default)

## DNS Provider Configuration

### If using HostAfrica (or similar):

1. **Log in to your DNS provider:**
   - Go to your DNS management panel for `ruakadrinksdelivery.co.ke`

2. **Add CNAME for admin subdomain:**
   - Click **Add Record**
   - Type: **CNAME**
   - Host/Name: **admin**
   - Value: **ghs.googlehosted.com** (or `ghs.googlehosted.com.` with trailing dot)
   - TTL: **3600**

3. **Add CNAME for www.admin subdomain:**
   - Click **Add Record**
   - Type: **CNAME**
   - Host/Name: **www.admin**
   - Value: **ghs.googlehosted.com** (or `ghs.googlehosted.com.` with trailing dot)
   - TTL: **3600**

**Important:** Unlike the root domain which requires A records, subdomains can use CNAME records.

## Verification

After adding DNS records, verify with:

```bash
# Check CNAME
dig admin.ruakadrinksdelivery.co.ke CNAME
dig www.admin.ruakadrinksdelivery.co.ke CNAME

# Check A records
dig admin.ruakadrinksdelivery.co.ke A
dig www.admin.ruakadrinksdelivery.co.ke A
```

## SSL Certificate

Cloud Run will automatically provision SSL certificates once DNS records are configured and propagated (usually takes 15-60 minutes).

## Service URL

The admin frontend service is available at:
- **Cloud Run URL:** https://deliveryos-admin-frontend-lssctajjoq-uc.a.run.app
- **Custom Domain (after DNS):** https://admin.ruakadrinksdelivery.co.ke
- **Custom Domain (www):** https://www.admin.ruakadrinksdelivery.co.ke

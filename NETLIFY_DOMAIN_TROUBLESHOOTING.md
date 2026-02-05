# Netlify Domain Troubleshooting: drinksdeliverykenya.com

## Issue
Domain `drinksdeliverykenya.com` is configured to Netlify DNS but still serving old site.

## Common Causes & Solutions

### 1. DNS Propagation Delay
DNS changes can take 24-48 hours to propagate globally.

**Check current DNS:**
```bash
dig drinksdeliverykenya.com +short
nslookup drinksdeliverykenya.com
```

**Expected Netlify DNS:**
- Should point to Netlify's load balancer IPs (varies by region)
- Or CNAME to a Netlify subdomain

### 2. Netlify Custom Domain Not Configured

**Steps to configure:**

1. **In Netlify Dashboard:**
   - Go to your site → **Domain settings**
   - Click **Add custom domain**
   - Enter: `drinksdeliverykenya.com`
   - Click **Verify**

2. **Add DNS Records:**
   
   **Option A: Use Netlify DNS (Recommended)**
   - In Netlify → Domain settings → DNS
   - Add A record pointing to Netlify's IP
   - Or add CNAME record pointing to your Netlify site URL
   
   **Option B: Use External DNS Provider**
   - Add A record: `@` → Netlify IP (check Netlify dashboard for IP)
   - Or CNAME: `@` → `your-site-name.netlify.app`
   - Add CNAME: `www` → `your-site-name.netlify.app`

### 3. SSL Certificate Not Issued

Netlify needs to issue an SSL certificate for the custom domain.

**Check:**
- Go to **Domain settings → HTTPS**
- Wait for certificate to be issued (can take a few minutes)
- If it fails, check DNS configuration

### 4. DNS Cache Issues

**Clear DNS cache:**
```bash
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Check from different location
dig @8.8.8.8 drinksdeliverykenya.com
```

### 5. Old Site Still Cached

**Check:**
- Browser cache (hard refresh: Cmd+Shift+R)
- CDN cache (if old site used CDN)
- DNS cache at ISP level

### 6. Wrong Netlify Site

Ensure the domain is pointing to the correct Netlify site (customer frontend, not admin).

---

## Step-by-Step Fix

### Step 1: Verify Netlify Site is Deployed

1. Go to Netlify dashboard
2. Check your customer frontend site
3. Verify latest deployment is successful
4. Test the Netlify URL directly: `https://your-site-name.netlify.app`

### Step 2: Add Custom Domain in Netlify

1. Site settings → **Domain management**
2. Click **Add custom domain**
3. Enter: `drinksdeliverykenya.com`
4. Click **Verify**
5. Follow Netlify's DNS instructions

### Step 3: Configure DNS Records

**If using Netlify DNS:**
- Netlify will provide DNS records automatically
- Update your domain registrar to use Netlify's nameservers

**If using external DNS (e.g., HostAfrica):**

**For root domain (drinksdeliverykenya.com):**
- Add A record: `@` → Netlify IP (get from Netlify dashboard)
- Or ALIAS/ANAME record: `@` → `your-site.netlify.app`

**For www subdomain:**
- Add CNAME: `www` → `your-site.netlify.app`

**Netlify IPs (may vary by region):**
- Check your Netlify site's domain settings for the exact IP
- Common Netlify IPs: `75.2.60.5`, `99.83.190.102` (verify in dashboard)

### Step 4: Wait for DNS Propagation

- DNS changes can take 24-48 hours
- Use `dig` or `nslookup` to check propagation
- Test from different locations

### Step 5: Verify SSL Certificate

1. Go to **Domain settings → HTTPS**
2. Wait for Let's Encrypt certificate to be issued
3. Should be automatic once DNS is correct

### Step 6: Force HTTPS Redirect

In Netlify domain settings:
- Enable **Force HTTPS**
- Enable **HTTPS redirect**

---

## Quick Verification Commands

```bash
# Check DNS records
dig drinksdeliverykenya.com +short
dig www.drinksdeliverykenya.com +short

# Check from Google DNS
dig @8.8.8.8 drinksdeliverykenya.com

# Check SSL certificate
openssl s_client -connect drinksdeliverykenya.com:443 -servername drinksdeliverykenya.com

# Check HTTP headers
curl -I https://drinksdeliverykenya.com
```

---

## Expected Netlify Configuration

### DNS Records (External DNS Provider)

```
Type    Name    Value
A       @       <Netlify IP from dashboard>
CNAME   www     your-site-name.netlify.app
```

### Netlify Domain Settings

- Custom domain: `drinksdeliverykenya.com`
- SSL: Issued (Let's Encrypt)
- HTTPS: Enabled
- Force HTTPS: Enabled

---

## Troubleshooting Checklist

- [ ] Netlify site is deployed and accessible via `.netlify.app` URL
- [ ] Custom domain added in Netlify dashboard
- [ ] DNS records configured correctly at domain registrar
- [ ] DNS propagation completed (check with `dig`)
- [ ] SSL certificate issued in Netlify
- [ ] Force HTTPS enabled
- [ ] Browser cache cleared
- [ ] Tested from different network/location

---

## If Still Not Working

1. **Check Netlify deployment logs** for any errors
2. **Verify domain ownership** in Netlify
3. **Check domain registrar** for any DNS restrictions
4. **Contact Netlify support** with:
   - Site name
   - Domain name
   - DNS records screenshot
   - Error messages (if any)

---

## Additional Notes

- Netlify automatically handles SSL certificates via Let's Encrypt
- DNS propagation can take up to 48 hours globally
- Some DNS providers have longer TTL values
- Old site may be cached at CDN level (if it used a CDN)
- Check if old site is still running and needs to be stopped

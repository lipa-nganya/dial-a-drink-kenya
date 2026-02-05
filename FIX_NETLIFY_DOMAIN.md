# Fix Netlify Domain: drinksdeliverykenya.com

## Current Issue
Domain `drinksdeliverykenya.com` is pointing to IP `102.218.215.117` (old hosting) instead of Netlify.

## Solution Steps

### Step 1: Verify Netlify Site is Deployed

1. Go to Netlify dashboard: https://app.netlify.com
2. Login with: `dialadrinkkenya254@gmail.com` / `Malibu2026.`
3. Find your customer frontend site
4. Verify it's deployed and working at the `.netlify.app` URL
5. Note the Netlify site name (e.g., `dialadrink-customer-xyz123.netlify.app`)

### Step 2: Add Custom Domain in Netlify

1. In Netlify dashboard → Your site → **Site settings**
2. Click **Domain management**
3. Click **Add custom domain**
4. Enter: `drinksdeliverykenya.com`
5. Click **Verify**

### Step 3: Choose DNS Configuration Method

Netlify will show you two options:

#### Option A: Use Netlify DNS (Recommended for root domains)

**If you choose Netlify DNS:**
1. Netlify will provide nameservers
2. Update your domain registrar to use Netlify's nameservers
3. Example nameservers (Netlify will provide exact ones):
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`
   - `dns3.p01.nsone.net`
   - `dns4.p01.nsone.net`

#### Option B: Use External DNS (Keep current DNS provider)

**If keeping your current DNS provider:**

**For Root Domain (drinksdeliverykenya.com):**

You have two options:

**Option B1: ALIAS/ANAME Record (Best for root domain)**
```
Type: ALIAS (or ANAME)
Name: @
Value: your-site-name.netlify.app
TTL: 3600
```

**Option B2: A Record (If ALIAS not available)**
```
Type: A
Name: @
Value: 75.2.60.5 (or Netlify IP from dashboard)
TTL: 3600
```

**Note:** Check Netlify dashboard for the exact IP. Common Netlify IPs:
- `75.2.60.5`
- `99.83.190.102`
- `151.101.1.195`
- `151.101.65.195`

**For www subdomain:**
```
Type: CNAME
Name: www
Value: your-site-name.netlify.app
TTL: 3600
```

### Step 4: Update DNS Records

**If using HostAfrica or similar DNS provider:**

1. Login to your DNS provider
2. Find DNS management for `drinksdeliverykenya.com`
3. **Remove or update the A record** pointing to `102.218.215.117`
4. **Add new record:**

   **For root domain:**
   - Type: `ALIAS` or `ANAME` (preferred)
   - Name: `@` or leave blank
   - Value: `your-site-name.netlify.app` (from Netlify dashboard)
   - TTL: `3600`

   **OR if ALIAS not available:**
   - Type: `A`
   - Name: `@` or leave blank
   - Value: `<Netlify IP>` (get from Netlify dashboard)
   - TTL: `3600`

   **For www subdomain:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `your-site-name.netlify.app`
   - TTL: `3600`

### Step 5: Wait for DNS Propagation

- DNS changes can take 24-48 hours to propagate globally
- Usually works within 1-2 hours
- Check propagation: `dig drinksdeliverykenya.com +short`
- Should eventually show Netlify IP or resolve to Netlify

### Step 6: Verify SSL Certificate

1. In Netlify → Domain settings → HTTPS
2. Wait for Let's Encrypt certificate to be issued
3. Should be automatic once DNS is correct
4. Enable **Force HTTPS** and **HTTPS redirect**

### Step 7: Clear Caches

**Browser:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

**DNS Cache (macOS):**
```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Test from different location:**
```bash
dig @8.8.8.8 drinksdeliverykenya.com
```

---

## Quick Fix Commands

### Check Current DNS
```bash
dig drinksdeliverykenya.com +short
dig www.drinksdeliverykenya.com +short
```

### Check DNS from Google
```bash
dig @8.8.8.8 drinksdeliverykenya.com
```

### Test Site Response
```bash
curl -I https://drinksdeliverykenya.com
```

---

## Expected Configuration

### After Fix - DNS Should Show:

**Option 1: Using ALIAS/ANAME**
```
drinksdeliverykenya.com → CNAME/ALIAS → your-site.netlify.app
```

**Option 2: Using A Record**
```
drinksdeliverykenya.com → A → 75.2.60.5 (Netlify IP)
```

**Both should work, but ALIAS/ANAME is preferred for root domains.**

---

## Troubleshooting

### Still showing old site after DNS update?

1. **Check DNS propagation:**
   ```bash
   dig drinksdeliverykenya.com @8.8.8.8
   ```
   Should show Netlify IP or CNAME

2. **Check Netlify domain settings:**
   - Domain added in Netlify?
   - SSL certificate issued?
   - Force HTTPS enabled?

3. **Check browser cache:**
   - Clear browser cache
   - Try incognito/private mode
   - Try different browser

4. **Check if old site is still running:**
   - Old hosting might still be active
   - May need to stop old hosting service

5. **Wait longer:**
   - DNS can take up to 48 hours
   - Some DNS providers have longer TTL

### DNS not updating?

1. Check TTL value (should be 3600 or lower)
2. Verify DNS records are saved correctly
3. Check for DNS propagation delays
4. Try different DNS provider temporarily

---

## Important Notes

- **Root domain (apex domain)** cannot use CNAME in standard DNS
- Use **ALIAS/ANAME** record if available (most modern DNS providers support this)
- If ALIAS not available, use **A record** with Netlify IP
- **www subdomain** can use CNAME
- Netlify automatically handles SSL certificates
- Both `drinksdeliverykenya.com` and `www.drinksdeliverykenya.com` can point to same Netlify site

---

## Verification Checklist

After making changes:

- [ ] Domain added in Netlify dashboard
- [ ] DNS records updated at DNS provider
- [ ] Removed old A record (102.218.215.117)
- [ ] Added ALIAS/ANAME or A record pointing to Netlify
- [ ] Added CNAME for www subdomain
- [ ] Waited for DNS propagation (check with `dig`)
- [ ] SSL certificate issued in Netlify
- [ ] Force HTTPS enabled
- [ ] Tested site in browser (clear cache first)
- [ ] Site shows Netlify content, not old site

---

## Next Steps After Fix

Once domain is working:

1. Update backend CORS to include `drinksdeliverykenya.com`
2. Test all functionality
3. Monitor for any issues
4. Set up monitoring/alerts if needed

# Fix SSL Certificate Error for Staging Domain

## Problem
Getting `ERR_CERT_COMMON_NAME_INVALID` error when accessing `staging.dialadrinkkenya.com`

## Root Cause
The CNAME record is likely pointing to the wrong target. For Netlify, you must point to Netlify's infrastructure, not to another custom domain.

---

## Solution: Get the Correct CNAME Target from Netlify

### Step 1: Find Your Netlify Site Subdomain
Even though `dialadrink.thewolfgang.tech` is your primary domain, you need to find the underlying Netlify subdomain:

**Method 1: From Site Overview**
1. Go to [app.netlify.com](https://app.netlify.com)
2. Select the site that uses `dialadrink.thewolfgang.tech` as primary
3. Look at the site overview - you'll see a URL like `https://[site-name].netlify.app`
4. This is your Netlify subdomain (e.g., `amazing-site-12345.netlify.app`)

**Method 2: From Domain Management**
1. Go to **Site settings** → **Domain management**
2. Look at the list of domains - you'll see the Netlify subdomain listed
3. It will be something like `[site-name].netlify.app`

### Step 2: Check Domain Status
- Look for `staging.dialadrinkkenya.com` in the domain list
- If the domain is **NOT listed**: You need to add it first (see Step 3)
- If the domain **IS listed**: Check what Netlify says the CNAME target should be

### Step 3: Add Domain in Netlify (if not added)
1. In **Domain management**, click **Add custom domain**
2. Enter: `staging.dialadrinkkenya.com`
3. Click **Verify**
4. **Netlify will show you the exact CNAME target to use**
   - It will be your site's `.netlify.app` subdomain (found in Step 1)
   - **DO NOT use `dialadrink.thewolfgang.tech` as the target**
   - Even though that's your primary domain, DNS must point to Netlify's infrastructure

### Step 4: Update DNS Record in HostAfrica
The CNAME target should be Netlify's subdomain, NOT `dialadrink.thewolfgang.tech`

**Correct DNS Record:**
```
Type:    CNAME
Host:    staging
Target:  [Netlify-provided-subdomain].netlify.app
TTL:     3600
```

**Example:**
```
Type:    CNAME
Host:    staging
Target:  amazing-site-12345.netlify.app
TTL:     3600
```

### Step 5: Verify DNS is Correct
After updating the DNS record, verify it points to Netlify:

```bash
# Check what the CNAME points to
dig staging.dialadrinkkenya.com CNAME +short

# Should return something like: amazing-site-12345.netlify.app.
# NOT: dialadrink.thewolfgang.tech.
```

### Step 6: Wait for SSL Provisioning
1. After DNS propagates (5-60 minutes), Netlify will automatically provision SSL
2. Check Netlify dashboard → **Domain management** → **HTTPS**
3. Status should change from "Certificate provisioning" to "Certificate active"
4. This takes 5-15 minutes after DNS propagation

---

## Alternative: If Netlify Shows Different Instructions

Some Netlify sites use different CNAME targets. Always use **exactly what Netlify shows** in the domain management page.

Common Netlify CNAME targets:
- `[site-name].netlify.app`
- `[random-id].netlify.app`
- Sometimes a specific CNAME like `cname.netlify.com`

**Never use:**
- ❌ Another custom domain (like `dialadrink.thewolfgang.tech`)
- ❌ An IP address
- ❌ A protocol (`https://` or `http://`)

---

## Quick Fix Checklist

1. [ ] Login to Netlify dashboard
2. [ ] Go to Site settings → Domain management
3. [ ] Add `staging.dialadrinkkenya.com` if not already added
4. [ ] **Copy the exact CNAME target Netlify provides**
5. [ ] Login to HostAfrica DNS management
6. [ ] Update the CNAME record to use Netlify's target (NOT `dialadrink.thewolfgang.tech`)
7. [ ] Wait 5-60 minutes for DNS propagation
8. [ ] Wait 5-15 minutes for SSL certificate provisioning
9. [ ] Test `https://staging.dialadrinkkenya.com`

---

## Why This Happens

When you add a custom domain to Netlify:
- Netlify needs the DNS to point to **Netlify's infrastructure** (their `.netlify.app` subdomain)
- Netlify then handles routing that subdomain to your site
- Both `dialadrink.thewolfgang.tech` (primary) and `staging.dialadrinkkenya.com` (alias) point to the same Netlify site
- But the DNS records must point to Netlify's infrastructure, not to each other
- The "primary domain" setting in Netlify is just for display/preferences - it doesn't change DNS requirements

---

## Verification Commands

```bash
# Check DNS resolution
dig staging.dialadrinkkenya.com CNAME +short

# Check if it resolves to Netlify
nslookup staging.dialadrinkkenya.com

# Check SSL certificate (after provisioning)
openssl s_client -connect staging.dialadrinkkenya.com:443 -servername staging.dialadrinkkenya.com | grep "subject="
```

---

## Still Having Issues?

1. **Clear browser cache** - Sometimes browsers cache SSL errors
2. **Try incognito/private mode** - To bypass cache
3. **Check Netlify domain status** - Should show "Certificate active"
4. **Verify DNS propagation** - Use multiple DNS checkers online
5. **Contact Netlify support** - If SSL still doesn't provision after 24 hours

---

## Important Note

The original documentation incorrectly suggested pointing the CNAME to `dialadrink.thewolfgang.tech`. This was wrong. Always use the CNAME target that Netlify provides in the domain management interface.


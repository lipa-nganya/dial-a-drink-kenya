# Staging Domain Setup Guide

## Overview
This guide configures `staging.dialadrinkkenya.com` to serve the same Netlify site as `dialadrink.thewolfgang.tech` without duplicating content or affecting the production site on HostAfrica.

---

## Step 1: Add Custom Domain in Netlify

### 1.1 Access Netlify Dashboard
1. Go to [app.netlify.com](https://app.netlify.com)
2. Log in with your Netlify credentials
3. Select the site that currently uses `dialadrink.thewolfgang.tech`

### 1.2 Add Custom Domain
1. Navigate to **Site settings** → **Domain management**
2. Click **Add custom domain**
3. Enter: `staging.dialadrinkkenya.com`
4. Click **Verify**
5. Netlify will show you the DNS configuration needed

### 1.3 Important Notes
- **DO NOT** set this as the primary domain
- **DO NOT** remove or modify `dialadrink.thewolfgang.tech`
- Both domains will serve the same content from the same deploy
- Netlify will automatically provision SSL certificates for both domains

---

## Step 2: Configure DNS on HostAfrica

### 2.1 Login to HostAfrica
1. Go to [myhostafrica.com](https://myhostafrica.com)
2. Login with:
   - **Email**: `mmumoki@gmail.com`
   - **Password**: `SaleEgos90`

### 2.2 Navigate to DNS Management
1. Find the domain: `dialadrinkkenya.com`
2. Go to **DNS Management** or **DNS Records**
3. **DO NOT** modify any existing records for the apex domain (`dialadrinkkenya.com`)

### 2.3 Add CNAME Record for Staging Subdomain

**⚠️ IMPORTANT: Get the CNAME target from Netlify first!**

Before adding the DNS record:
1. In Netlify dashboard → **Domain management**, add `staging.dialadrinkkenya.com`
2. Netlify will show you the **exact CNAME target** to use
3. It will look like: `[site-name].netlify.app` or similar
4. **DO NOT use `dialadrink.thewolfgang.tech` as the target**

**Add the following DNS record (using Netlify's provided target):**

| Field | Value |
|-------|-------|
| **Type** | `CNAME` |
| **Host/Name** | `staging` |
| **Target/Points to** | `[Netlify-provided-subdomain].netlify.app` |
| **TTL** | `3600` (or default) |

**Example:**
- If Netlify shows: `amazing-site-12345.netlify.app`
- Then use that as the target

**Important Constraints:**
- ✅ Use **CNAME** record type (NOT A record)
- ✅ Host/Name should be just `staging` (NOT `staging.dialadrinkkenya.com`)
- ✅ Target should be the **Netlify subdomain** provided by Netlify (NOT `dialadrink.thewolfgang.tech`)
- ✅ Target should be the domain name only (NO `https://` or `http://` prefix, NO trailing slash)
- ❌ Do NOT use an IP address
- ❌ Do NOT use another custom domain as target
- ❌ Do NOT include protocol (`https://` or `http://`)

### 2.4 Save and Wait for Propagation
- Click **Save** or **Add Record**
- DNS propagation typically takes 5-60 minutes
- You can verify with: `dig staging.dialadrinkkenya.com CNAME` or `nslookup staging.dialadrinkkenya.com`

---

## Step 3: Verify SSL Certificate

### 3.1 Automatic SSL Provisioning
- Netlify automatically provisions SSL certificates via Let's Encrypt
- This happens automatically after DNS propagation completes
- You can check status in Netlify: **Site settings** → **Domain management** → **HTTPS**

### 3.2 SSL Certificate Status
- Wait 5-15 minutes after DNS propagation
- Netlify will show "Certificate provisioning" → "Certificate active"
- Both domains will have valid SSL certificates

---

## Step 4: Prevent Search Engine Indexing (Staging)

### 4.1 Add robots.txt
Create or update `admin-frontend/public/robots.txt`:

```
User-agent: *
Disallow: /
```

### 4.2 Update netlify.toml
Add header configuration to prevent indexing on staging domain only:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"

[[headers]]
  for = "/staging.dialadrinkkenya.com/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
```

**Note:** Since both domains serve the same content, the `X-Robots-Tag` header will apply to both. If you need staging-only indexing prevention, you'll need to use Netlify's split testing or branch deploys feature.

### 4.3 Alternative: Meta Tag in HTML
If you have access to the HTML template, add to `<head>`:

```html
<meta name="robots" content="noindex, nofollow">
```

---

## Step 5: Verify Configuration

### 5.1 Test Both Domains
1. Visit `https://dialadrink.thewolfgang.tech` - should work as before
2. Visit `https://staging.dialadrinkkenya.com` - should show identical content
3. Both should have valid SSL certificates (green padlock)

### 5.2 Verify DNS
Run these commands to verify DNS is configured correctly:

```bash
# Check CNAME record
dig staging.dialadrinkkenya.com CNAME +short
# Should return: dialadrink.thewolfgang.tech.

# Or use nslookup
nslookup staging.dialadrinkkenya.com
# Should show CNAME pointing to dialadrink.thewolfgang.tech
```

### 5.3 Verify SSL
```bash
# Check SSL certificate
openssl s_client -connect staging.dialadrinkkenya.com:443 -servername staging.dialadrinkkenya.com
```

---

## Step 6: Common Mistakes to Avoid

### ❌ DO NOT:
1. **Use A records** - Netlify uses dynamic IPs, CNAME is required
2. **Point to IP addresses** - Always use domain names
3. **Include protocols** - DNS records should NOT include `https://` or `http://`
4. **Modify production DNS** - Do NOT change any records for `dialadrinkkenya.com` (apex domain)
5. **Set staging as primary** - Keep `dialadrink.thewolfgang.tech` as primary domain
6. **Use domain forwarding** - This creates redirects, not aliasing
7. **Duplicate the site** - Both domains should point to the same Netlify site

### ✅ DO:
1. **Use CNAME records** for subdomains
2. **Wait for DNS propagation** (5-60 minutes)
3. **Verify SSL provisioning** in Netlify dashboard
4. **Test both domains** after setup
5. **Keep production DNS untouched**

---

## Step 7: Troubleshooting

### Issue: DNS not resolving
- **Check**: Verify CNAME record is saved correctly in HostAfrica
- **Wait**: DNS propagation can take up to 60 minutes
- **Verify**: Use `dig` or `nslookup` to check DNS records

### Issue: SSL certificate not provisioning
- **Check**: DNS must be fully propagated first
- **Wait**: SSL provisioning takes 5-15 minutes after DNS
- **Verify**: Check Netlify dashboard → Domain management → HTTPS

### Issue: Staging domain shows different content
- **Check**: Both domains should be listed in Netlify → Domain management
- **Verify**: Both should point to the same site/deploy
- **Note**: Content is identical by default when using domain aliasing

### Issue: Production site affected
- **Check**: Verify no DNS records for `dialadrinkkenya.com` were modified
- **Verify**: Only `staging` subdomain was added
- **Confirm**: Production site should be completely unaffected

---

## Summary

### DNS Record (Copy-Paste Ready)

**⚠️ IMPORTANT: Get the exact target from Netlify first!**

After adding the domain in Netlify, use the target Netlify provides:

```
Type: CNAME
Host: staging
Target: [Get this from Netlify - usually ends in .netlify.app]
TTL: 3600
```

**Example:**
```
Type: CNAME
Host: staging
Target: amazing-site-12345.netlify.app
TTL: 3600
```

**DO NOT use `dialadrink.thewolfgang.tech` as the target!**

### Netlify Configuration
- Add `staging.dialadrinkkenya.com` as custom domain (NOT primary)
- Keep `dialadrink.thewolfgang.tech` as primary domain
- SSL will auto-provision for both domains

### Result
- ✅ `staging.dialadrinkkenya.com` serves same content as `dialadrink.thewolfgang.tech`
- ✅ Both domains have valid SSL certificates
- ✅ Production site (`dialadrinkkenya.com`) remains untouched
- ✅ No content duplication
- ✅ No redirects (true aliasing)

---

## Next Steps After Setup

1. **Wait for DNS propagation** (check with `dig` or `nslookup`)
2. **Wait for SSL provisioning** (check Netlify dashboard)
3. **Test both domains** in browser
4. **Verify search engine blocking** (check robots.txt and headers)
5. **Document the setup** for team reference

---

## Support Resources

- **Netlify Docs**: [Custom Domains](https://docs.netlify.com/domains-https/custom-domains/)
- **Netlify Docs**: [DNS Configuration](https://docs.netlify.com/domains-https/dns-overview/)
- **HostAfrica Support**: Contact if DNS management interface differs


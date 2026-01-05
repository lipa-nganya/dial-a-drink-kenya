# Staging Domain Setup Checklist

## Quick Setup Steps

### ✅ Step 1: Netlify Configuration (5 minutes)
- [ ] Login to [app.netlify.com](https://app.netlify.com)
- [ ] Select site with `dialadrink.thewolfgang.tech` (primary domain)
- [ ] **Find your Netlify subdomain** (see site overview - looks like `site-name.netlify.app`)
- [ ] Go to **Site settings** → **Domain management**
- [ ] Click **Add custom domain**
- [ ] Enter: `staging.dialadrinkkenya.com`
- [ ] Click **Verify**
- [ ] **Note the CNAME target** Netlify shows (should be your `.netlify.app` subdomain)
- [ ] **DO NOT** set as primary domain
- [ ] Keep `dialadrink.thewolfgang.tech` as primary

### ✅ Step 2: DNS Configuration on HostAfrica (2 minutes)
- [ ] **First**: In Netlify, note the CNAME target shown (usually ends in `.netlify.app`)
- [ ] Login to [myhostafrica.com](https://myhostafrica.com)
  - Email: `mmumoki@gmail.com`
  - Password: `SaleEgos90`
- [ ] Navigate to DNS management for `dialadrinkkenya.com`
- [ ] **DO NOT** modify any existing records
- [ ] Add new CNAME record:
  - Type: `CNAME`
  - Host: `staging`
  - Target: `[Use the Netlify-provided target, e.g., site-name-123.netlify.app]`
  - TTL: `3600` (or default)
- [ ] **DO NOT use `dialadrink.thewolfgang.tech` as target**
- [ ] Save record

### ✅ Step 3: Wait for Propagation (5-60 minutes)
- [ ] Wait for DNS propagation
- [ ] Verify with: `dig staging.dialadrinkkenya.com CNAME` or `nslookup staging.dialadrinkkenya.com`
- [ ] Should return: `dialadrink.thewolfgang.tech`

### ✅ Step 4: Verify SSL (5-15 minutes after DNS)
- [ ] Check Netlify dashboard → **Domain management** → **HTTPS**
- [ ] Wait for "Certificate active" status
- [ ] Both domains should show valid SSL

### ✅ Step 5: Test (2 minutes)
- [ ] Visit `https://dialadrink.thewolfgang.tech` - should work as before
- [ ] Visit `https://staging.dialadrinkkenya.com` - should show identical content
- [ ] Both should have green padlock (valid SSL)
- [ ] Verify production site (`dialadrinkkenya.com`) is unaffected

---

## DNS Record (Copy-Paste)

⚠️ **Get the target from Netlify first!**

```
Type:    CNAME
Host:    staging
Target:  [Get from Netlify - e.g., site-name-123.netlify.app]
TTL:     3600
```

**DO NOT use `dialadrink.thewolfgang.tech` as the target!**

---

## Common Mistakes to Avoid

❌ **DO NOT:**
- Use A records (must use CNAME)
- Point to IP addresses
- Include `https://` or `http://` in target
- Modify existing DNS records for `dialadrinkkenya.com`
- Set staging as primary domain in Netlify
- Use domain forwarding (creates redirects, not aliasing)

✅ **DO:**
- Use CNAME record type
- Wait for DNS propagation
- Wait for SSL provisioning
- Test both domains after setup
- Keep production DNS untouched

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| DNS not resolving | Wait 5-60 min, verify CNAME record is correct |
| SSL not provisioning | Wait 5-15 min after DNS propagation |
| **SSL certificate error (ERR_CERT_COMMON_NAME_INVALID)** | **See STAGING_SSL_FIX.md - CNAME target is wrong** |
| Different content | Verify both domains in Netlify domain management |
| Production affected | Verify no apex domain DNS records were modified |

---

## Files Updated

- ✅ `admin-frontend/netlify.toml` - Added X-Robots-Tag header
- ✅ `admin-frontend/public/robots.txt` - Created to prevent indexing
- ✅ `STAGING_DOMAIN_SETUP.md` - Complete setup guide
- ✅ `STAGING_DNS_RECORD.txt` - Quick DNS reference
- ✅ `STAGING_SETUP_CHECKLIST.md` - This checklist

---

## Next Steps

After setup is complete:
1. Commit and push the updated `netlify.toml` and `robots.txt` files
2. Netlify will automatically redeploy with the new configuration
3. Both domains will serve identical content with search engine indexing prevention

---

## Support

- Full guide: See `STAGING_DOMAIN_SETUP.md`
- DNS record: See `STAGING_DNS_RECORD.txt`
- Find Netlify subdomain: See `FIND_NETLIFY_SUBDOMAIN.md`
- SSL errors: See `STAGING_SSL_FIX.md`
- Netlify docs: https://docs.netlify.com/domains-https/custom-domains/


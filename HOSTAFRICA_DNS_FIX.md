# HostAfrica DNS Configuration - Immediate Fix Required

## Current Status

❌ **PROBLEM DETECTED**: The DNS record is currently pointing to the wrong target!

**Current DNS:**
```
staging.dialadrinkkenya.com → dialadrink.thewolfgang.tech (WRONG!)
```

**Should be:**
```
staging.dialadrinkkenya.com → dialadrink-customer.netlify.app (CORRECT)
```

This is why you're getting the SSL certificate error (`ERR_CERT_COMMON_NAME_INVALID`).

---

## Immediate Action Required

### Step 1: Login to HostAfrica

1. Go to: https://myhostafrica.com
2. Login with:
   - **Email**: `mmumoki@gmail.com`
   - **Password**: `SaleEgos90`

### Step 2: Navigate to DNS Management

1. Find the domain: **dialadrinkkenya.com**
2. Click on it or go to **DNS Management** / **DNS Records**

### Step 3: Find and Edit the Existing CNAME Record

1. Look for a CNAME record with:
   - **Host/Name**: `staging`
   - **Current Target**: `dialadrink.thewolfgang.tech` ❌

2. **Edit this record** and change the target to:
   - **New Target**: `dialadrink-customer.netlify.app` ✅

### Step 4: Save the Changes

1. Click **Save** or **Update**
2. Confirm the changes

---

## Exact DNS Record Configuration

After the fix, your DNS record should be:

```
┌─────────────────────────────────────────────┐
│ Type:    CNAME                              │
│ Host:    staging                            │
│ Target:  dialadrink-customer.netlify.app   │
│ TTL:     3600 (or default)                  │
└─────────────────────────────────────────────┘
```

**Important:**
- ✅ Host should be just `staging` (NOT `staging.dialadrinkkenya.com`)
- ✅ Target should be `dialadrink-customer.netlify.app` (NOT `dialadrink.thewolfgang.tech`)
- ✅ No `https://` or `http://` prefix
- ✅ No trailing slash

---

## Verification

After updating the DNS record, verify it's correct:

```bash
# Check DNS (wait 5-60 minutes for propagation)
dig staging.dialadrinkkenya.com CNAME +short

# Should return: dialadrink-customer.netlify.app.
# NOT: dialadrink.thewolfgang.tech.
```

---

## Timeline

1. **Update DNS record**: Immediate (you're doing this now)
2. **DNS propagation**: 5-60 minutes
3. **SSL certificate provisioning**: 5-15 minutes after DNS propagates
4. **Total time**: ~15-75 minutes

---

## After DNS Update

Once the DNS record is updated:

1. **Wait for DNS propagation** (check with `dig` command above)
2. **Netlify will automatically provision SSL certificate**
3. **Test the site**: https://staging.dialadrinkkenya.com
4. **Should work without SSL errors**

---

## Why This Fixes the SSL Error

- Netlify can only provision SSL certificates for domains that point to Netlify's infrastructure
- `dialadrink.thewolfgang.tech` is a custom domain, not Netlify's infrastructure
- `dialadrink-customer.netlify.app` is Netlify's infrastructure
- Once DNS points to Netlify's infrastructure, SSL provisioning works automatically

---

## Quick Reference

**Current (Wrong):**
```
staging → dialadrink.thewolfgang.tech
```

**Correct:**
```
staging → dialadrink-customer.netlify.app
```

---

## Need Help?

If you can't find the DNS record or need assistance:
1. Look for "DNS Management" or "DNS Records" in HostAfrica dashboard
2. Search for records with "staging" in the name
3. The record type should be "CNAME"
4. Update the target/value field


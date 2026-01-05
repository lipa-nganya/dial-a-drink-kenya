# SSL Certificate Issue Diagnosis

## Problem Identified

The SSL certificate error (`ERR_CERT_COMMON_NAME_INVALID`) is occurring because:

**Netlify is serving a wildcard certificate for `*.netlify.app`**, but **hasn't provisioned a certificate for `staging.dialadrinkkenya.com` yet**.

### What's Happening

1. ✅ DNS is correctly configured: `staging.dialadrinkkenya.com` → `dialadrink-customer.netlify.app`
2. ✅ Domain is added to Netlify: `staging.dialadrinkkenya.com` is in domain aliases
3. ❌ SSL certificate not yet provisioned: Netlify is still using the default `*.netlify.app` certificate

### Evidence

```
Certificate Subject: CN=*.netlify.app
Error: subjectAltName does not match host name staging.dialadrinkkenya.com
```

This means Netlify's SSL provisioning process hasn't completed yet.

---

## Solutions

### Solution 1: Wait for Automatic Provisioning (Recommended)

Netlify automatically provisions SSL certificates via Let's Encrypt. This typically takes:

- **5-15 minutes** after DNS fully propagates
- Sometimes up to **30 minutes** in rare cases

**What to do:**
1. Wait 15-30 minutes
2. Check Netlify dashboard: Site settings → Domain management → HTTPS
3. Look for `staging.dialadrinkkenya.com` status

### Solution 2: Check Netlify Dashboard

1. Go to: https://app.netlify.com
2. Select site: **dialadrink-customer**
3. Navigate to: **Site settings** → **Domain management** → **HTTPS**
4. Look for `staging.dialadrinkkenya.com`
5. Check status:
   - ✅ "Certificate active" = Working
   - ⏳ "Certificate provisioning" = In progress, wait
   - ❌ "Certificate error" = Problem, see below

### Solution 3: Force SSL Provisioning

If it's been more than 30 minutes:

1. **In Netlify Dashboard:**
   - Go to: Site settings → Domain management
   - Find: `staging.dialadrinkkenya.com`
   - Click: **Refresh** or **Retry** (if available)
   - Or: Remove and re-add the domain

2. **Verify DNS is correct:**
   ```bash
   dig staging.dialadrinkkenya.com CNAME +short
   # Should return: dialadrink-customer.netlify.app.
   ```

### Solution 4: Check for DNS Issues

Sometimes Netlify can't verify DNS ownership:

1. **Verify DNS propagation:**
   ```bash
   # Check from multiple DNS servers
   dig @8.8.8.8 staging.dialadrinkkenya.com CNAME +short
   dig @1.1.1.1 staging.dialadrinkkenya.com CNAME +short
   dig @208.67.222.222 staging.dialadrinkkenya.com CNAME +short
   ```
   All should return: `dialadrink-customer.netlify.app.`

2. **Check if DNS is accessible globally:**
   - Use: https://dnschecker.org
   - Enter: `staging.dialadrinkkenya.com`
   - Check CNAME record globally

---

## Common Causes

### 1. DNS Not Fully Propagated
- **Symptom**: Some DNS servers show correct, others don't
- **Solution**: Wait for full propagation (can take up to 48 hours globally)

### 2. DNS Points to Wrong Target
- **Symptom**: DNS shows `dialadrink.thewolfgang.tech` instead of `dialadrink-customer.netlify.app`
- **Solution**: Update DNS record in HostAfrica

### 3. Domain Not Added to Netlify
- **Symptom**: Domain doesn't appear in Netlify domain management
- **Solution**: Add domain in Netlify dashboard

### 4. Netlify SSL Provisioning Delayed
- **Symptom**: Everything looks correct but SSL not working
- **Solution**: Wait longer, or contact Netlify support

---

## Verification Steps

### Step 1: Check DNS
```bash
dig staging.dialadrinkkenya.com CNAME +short
# Should return: dialadrink-customer.netlify.app.
```

### Step 2: Check SSL Certificate
```bash
openssl s_client -connect staging.dialadrinkkenya.com:443 -servername staging.dialadrinkkenya.com 2>&1 | grep "subject="
# Should show: subject=CN=staging.dialadrinkkenya.com (when working)
# Currently shows: subject=CN=*.netlify.app (not yet provisioned)
```

### Step 3: Check Netlify Dashboard
- Site settings → Domain management → HTTPS
- Look for `staging.dialadrinkkenya.com`
- Status should be "Certificate active"

---

## Expected Timeline

1. **DNS Update**: ✅ Complete (you've done this)
2. **DNS Propagation**: ✅ Complete (verified)
3. **Netlify SSL Provisioning**: ⏳ In progress (5-30 minutes)
4. **SSL Active**: ⏳ Waiting

---

## If Still Not Working After 1 Hour

1. **Check Netlify Dashboard** for any error messages
2. **Verify DNS** is correct globally (use dnschecker.org)
3. **Try removing and re-adding** the domain in Netlify
4. **Contact Netlify Support** if issue persists

---

## Quick Fix Command

Run this to check current status:
```bash
./diagnose-ssl-issue.sh
```

This will show you exactly what's wrong and what to fix.


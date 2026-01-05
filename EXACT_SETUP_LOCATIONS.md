# Exact Setup Locations for staging.dialadrinkkenya.com

## Overview
You need to configure `staging.dialadrinkkenya.com` in **TWO places**:
1. **Netlify** - Add the domain as a custom domain alias
2. **HostAfrica** - Add the DNS CNAME record

---

## Part 1: Netlify Configuration

### Step-by-Step Location

1. **Go to Netlify Dashboard**
   - URL: https://app.netlify.com
   - Login with your Netlify credentials

2. **Select Your Site**
   - Find and click on: **dialadrink-customer**
   - (This is the site with primary domain `dialadrink.thewolfgang.tech`)

3. **Navigate to Domain Management**
   - Click: **Site settings** (in the top navigation)
   - Click: **Domain management** (in the left sidebar)

4. **Add Custom Domain**
   - Click the button: **Add custom domain**
   - Enter: `staging.dialadrinkkenya.com`
   - Click: **Verify**

5. **Note the CNAME Target**
   - Netlify will show you the CNAME target to use
   - It should be: `dialadrink-customer.netlify.app`
   - **Copy this value** - you'll need it for HostAfrica

6. **Important Settings**
   - ✅ **DO NOT** set it as the primary domain
   - ✅ Keep `dialadrink.thewolfgang.tech` as primary
   - ✅ Leave it as an alias/domain alias

### Exact Navigation Path
```
Netlify Dashboard
  → dialadrink-customer (site)
    → Site settings
      → Domain management
        → Add custom domain
          → Enter: staging.dialadrinkkenya.com
```

---

## Part 2: HostAfrica DNS Configuration

### Step-by-Step Location

1. **Go to HostAfrica Dashboard**
   - URL: https://my.hostafrica.com
   - Login with:
     - Email: `mmumoki@gmail.com`
     - Password: `SaleEgos90`

2. **Navigate to DNS Management**
   - Hover over: **Domain** (in top navigation)
   - Click: **Manage DNS** (from dropdown menu)
   - OR navigate directly to: https://my.hostafrica.com/clientarea.php?action=domaindns

3. **Select Your Domain**
   - Find: **dialadrinkkenya.com** in the list
   - Click on it to view DNS records

4. **Add CNAME Record**
   - Click: **Add Record** or **+ Add** button
   - Select record type: **CNAME**
   - Fill in the fields:
     - **Host/Name**: `staging` (just "staging", NOT "staging.dialadrinkkenya.com")
     - **Target/Points to**: `dialadrink-customer.netlify.app`
     - **TTL**: `3600` (or leave default)
   - Click: **Save** or **Add Record**

5. **Verify the Record**
   - You should see a new CNAME record:
     - Type: CNAME
     - Host: staging
     - Target: dialadrink-customer.netlify.app

### Exact Navigation Path
```
HostAfrica Dashboard
  → Domain (hover)
    → Manage DNS
      → Select: dialadrinkkenya.com
        → Add Record
          → Type: CNAME
          → Host: staging
          → Target: dialadrink-customer.netlify.app
          → Save
```

---

## Current Status Check

### Verify in Netlify
1. Go to: https://app.netlify.com
2. Site: dialadrink-customer
3. Site settings → Domain management
4. Look for `staging.dialadrinkkenya.com` in the domain list
5. Status should show: "Certificate provisioning" or "Certificate active"

### Verify in HostAfrica
1. Go to: https://my.hostafrica.com
2. Domain → Manage DNS
3. Select: dialadrinkkenya.com
4. Look for CNAME record with:
   - Host: `staging`
   - Target: `dialadrink-customer.netlify.app`

### Verify DNS Propagation
```bash
# Run this command
dig staging.dialadrinkkenya.com CNAME +short

# Should return: dialadrink-customer.netlify.app.
```

---

## Quick Reference: DNS Record Details

**For HostAfrica DNS Management:**

```
┌─────────────────────────────────────────────┐
│ Record Type:  CNAME                         │
│ Host/Name:   staging                       │
│ Target:      dialadrink-customer.netlify.app│
│ TTL:         3600 (or default)              │
└─────────────────────────────────────────────┘
```

**Important Notes:**
- ✅ Host should be just `staging` (NOT `staging.dialadrinkkenya.com`)
- ✅ Target should be `dialadrink-customer.netlify.app` (NOT `dialadrink.thewolfgang.tech`)
- ✅ No `https://` or `http://` prefix
- ✅ No trailing slash

---

## Troubleshooting

### If domain not in Netlify:
- Go to: Site settings → Domain management → Add custom domain
- Enter: `staging.dialadrinkkenya.com`
- Click: Verify

### If DNS record not in HostAfrica:
- Go to: Domain → Manage DNS → Select dialadrinkkenya.com
- Click: Add Record
- Type: CNAME, Host: staging, Target: dialadrink-customer.netlify.app

### If you can't find DNS management:
- Try direct URL: https://my.hostafrica.com/clientarea.php?action=domaindns
- Or: Domain → My Domain → Select domain → Manage DNS

---

## Summary

**Netlify Setup:**
- Location: Site settings → Domain management
- Action: Add `staging.dialadrinkkenya.com` as custom domain (alias)

**HostAfrica Setup:**
- Location: Domain → Manage DNS → dialadrinkkenya.com
- Action: Add CNAME record (staging → dialadrink-customer.netlify.app)

Both must be configured for the staging domain to work!


# How to Create DNS Record for staging.dialadrinkkenya.com in HostAfrica

## The Issue

If `staging.dialadrinkkenya.com` is not defined in HostAfrica, **this is definitely the problem!**

Netlify cannot provision an SSL certificate if the DNS record doesn't exist or points to the wrong place.

---

## Step-by-Step: Create the DNS Record

### Step 1: Login to HostAfrica

1. Go to: https://my.hostafrica.com
2. Login with:
   - Email: `mmumoki@gmail.com`
   - Password: `SaleEgos90`

### Step 2: Navigate to DNS Management

**Option A: Via Menu**
1. Hover over **Domain** in the top navigation
2. Click **Manage DNS** from the dropdown

**Option B: Direct URL**
- Go to: https://my.hostafrica.com/clientarea.php?action=domaindns

### Step 3: Select Your Domain

1. Find **dialadrinkkenya.com** in the list of domains
2. Click on it to view DNS records

### Step 4: Add CNAME Record

1. Click **Add Record** or **+ Add** button
2. Select record type: **CNAME**
3. Fill in the form:

```
┌─────────────────────────────────────────────┐
│ Type:    CNAME                             │
│ Name:    staging                           │
│ Target:  dialadrink-customer.netlify.app  │
│ TTL:     3600 (or default)                 │
└─────────────────────────────────────────────┘
```

**Important:**
- **Name field**: Enter just `staging` (NOT `staging.dialadrinkkenya.com`)
- **Target field**: Enter `dialadrink-customer.netlify.app` (NOT `dialadrink.thewolfgang.tech`)
- **No protocols**: Don't include `https://` or `http://`
- **No trailing slash**: Don't add `/` at the end

### Step 5: Save the Record

1. Click **Save** or **Add Record**
2. Wait 2-3 minutes for the record to be created

### Step 6: Verify the Record

After saving, you should see a new record in the list:
- Type: CNAME
- Name: staging
- Target: dialadrink-customer.netlify.app

---

## What This Creates

When you add a CNAME record with:
- **Name**: `staging`
- **Domain**: `dialadrinkkenya.com`

It automatically creates: `staging.dialadrinkkenya.com`

You don't need to create a separate domain - the subdomain is created automatically by the DNS record.

---

## Verification

After creating the record, verify it exists:

```bash
# Check DNS record
dig staging.dialadrinkkenya.com CNAME +short

# Should return: dialadrink-customer.netlify.app.
```

Or use online tool:
- Go to: https://dnschecker.org
- Enter: `staging.dialadrinkkenya.com`
- Select: CNAME
- Should show: `dialadrink-customer.netlify.app`

---

## Common Mistakes to Avoid

❌ **Wrong Name:**
- `staging.dialadrinkkenya.com` (too long)
- `staging.` (with trailing dot)
- ✅ Correct: `staging`

❌ **Wrong Target:**
- `dialadrink.thewolfgang.tech` (custom domain, not Netlify)
- `https://dialadrink-customer.netlify.app` (with protocol)
- `dialadrink-customer.netlify.app/` (with trailing slash)
- ✅ Correct: `dialadrink-customer.netlify.app`

❌ **Wrong Type:**
- A record (should be CNAME)
- ✅ Correct: CNAME

---

## After Creating the Record

1. **Wait 5-10 minutes** for DNS propagation
2. **Netlify will automatically provision SSL** (5-15 minutes after DNS)
3. **Test**: https://staging.dialadrinkkenya.com

---

## If You Can't Find "Add Record" Button

Different HostAfrica interfaces have different layouts:

1. **Look for**: "Add", "New Record", "+", or "Create Record"
2. **Check**: If there's a table of DNS records, look for a button above or below it
3. **Try**: Right-clicking or looking for a menu with "Add" option
4. **Alternative**: Look for "DNS Zone Editor" or "DNS Records" section

---

## Quick Checklist

- [ ] Logged into HostAfrica
- [ ] Navigated to DNS Management
- [ ] Selected domain: dialadrinkkenya.com
- [ ] Clicked "Add Record"
- [ ] Selected type: CNAME
- [ ] Entered Name: staging
- [ ] Entered Target: dialadrink-customer.netlify.app
- [ ] Saved the record
- [ ] Verified record appears in list
- [ ] Waited 5-10 minutes for propagation
- [ ] Checked DNS: `dig staging.dialadrinkkenya.com CNAME +short`

---

## Still Having Issues?

If you can't find where to add the DNS record:

1. **Take a screenshot** of the DNS management page
2. **Look for**: Any button that says "Add", "New", "+", or "Create"
3. **Check**: If there's a table/list of existing DNS records, the add button is usually near it
4. **Alternative**: Contact HostAfrica support and ask: "How do I add a CNAME record for a subdomain?"

---

**This is the root cause!** Once you create this DNS record in HostAfrica, Netlify will be able to provision the SSL certificate.


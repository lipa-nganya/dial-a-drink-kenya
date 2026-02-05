# Netlify DNS Configuration Options

## Two Ways to Configure Domain with Netlify

You have **two options** for configuring `drinksdeliverykenya.com` with Netlify:

---

## Option 1: Use Netlify DNS (Change Nameservers) ✅ RECOMMENDED

### What This Means
- Change your domain's nameservers to Netlify's nameservers
- Netlify manages all DNS records
- **Simpler and easier to manage**

### Steps

1. **Add domain in Netlify:**
   - Netlify dashboard → Your site → Domain management
   - Add custom domain: `drinksdeliverykenya.com`
   - Netlify will show you nameservers to use

2. **Update nameservers at domain registrar:**
   - Go to where you registered `drinksdeliverykenya.com`
   - Find "Nameservers" or "DNS" settings
   - Replace current nameservers with Netlify's nameservers
   - Example Netlify nameservers (Netlify will provide exact ones):
     ```
     dns1.p01.nsone.net
     dns2.p01.nsone.net
     dns3.p01.nsone.net
     dns4.p01.nsone.net
     ```

3. **That's it!** Netlify automatically configures everything

### Pros
- ✅ Simple - just change nameservers
- ✅ Netlify manages all DNS automatically
- ✅ Easy to add subdomains later
- ✅ Automatic SSL certificate
- ✅ No need to manually configure A/CNAME records

### Cons
- ⚠️ You lose control of DNS at your current provider
- ⚠️ All DNS records must be managed in Netlify

---

## Option 2: Use External DNS (Keep Current DNS Provider)

### What This Means
- Keep your current DNS provider (e.g., HostAfrica, Cloudflare, etc.)
- Just update specific DNS records to point to Netlify
- **More control, but requires manual configuration**

### Steps

1. **Add domain in Netlify:**
   - Netlify dashboard → Your site → Domain management
   - Add custom domain: `drinksdeliverykenya.com`
   - Netlify will show you what DNS records to add

2. **Update DNS records at your current DNS provider:**
   
   **For root domain (drinksdeliverykenya.com):**
   
   **If your DNS provider supports ALIAS/ANAME (recommended):**
   ```
   Type: ALIAS (or ANAME)
   Name: @ (or leave blank)
   Value: your-site-name.netlify.app
   TTL: 3600
   ```
   
   **If ALIAS not available, use A record:**
   ```
   Type: A
   Name: @ (or leave blank)
   Value: 75.2.60.5 (get exact IP from Netlify dashboard)
   TTL: 3600
   ```
   
   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   TTL: 3600
   ```

3. **Remove old A record** pointing to `102.218.215.117`

### Pros
- ✅ Keep using your current DNS provider
- ✅ More control over DNS records
- ✅ Can manage other DNS records (email, etc.) at same place

### Cons
- ⚠️ Requires manual DNS record configuration
- ⚠️ Need to update records if Netlify IPs change
- ⚠️ Root domain needs ALIAS/ANAME or A record (CNAME won't work for root)

---

## Which Option Should You Choose?

### Use Option 1 (Netlify DNS) if:
- ✅ You only need the domain for the Netlify site
- ✅ You want the simplest setup
- ✅ You don't need to manage other DNS records
- ✅ You're okay with Netlify managing DNS

### Use Option 2 (External DNS) if:
- ✅ You need to manage other DNS records (email, subdomains, etc.)
- ✅ You want to keep DNS at your current provider
- ✅ You have complex DNS requirements
- ✅ Your DNS provider supports ALIAS/ANAME records

---

## Important Notes

### About Nameservers
- **Changing nameservers** means Netlify becomes your DNS provider
- **All DNS queries** for your domain go to Netlify's DNS servers
- **You can still** manage DNS records, but through Netlify's dashboard

### About DNS Records
- **If using external DNS**, you must manually configure records
- **Root domain** cannot use CNAME (DNS limitation)
- **ALIAS/ANAME** is preferred for root domains (if available)
- **A record** works but requires Netlify IP (may change)

### SSL Certificates
- **Both options** automatically get SSL certificates from Let's Encrypt
- **No manual SSL configuration** needed
- **Certificate is issued** once DNS is correctly configured

---

## Recommendation

**For `drinksdeliverykenya.com`, I recommend Option 1 (Netlify DNS):**

1. **Simpler** - Just change nameservers
2. **Less maintenance** - Netlify handles everything
3. **Easier troubleshooting** - Everything in one place
4. **Automatic updates** - If Netlify changes IPs, it's handled automatically

**Unless you have specific reasons to keep DNS at your current provider, Option 1 is the way to go.**

---

## Step-by-Step: Using Netlify DNS (Option 1)

### Step 1: Add Domain in Netlify
1. Go to Netlify dashboard
2. Select your customer frontend site
3. Site settings → Domain management
4. Click "Add custom domain"
5. Enter: `drinksdeliverykenya.com`
6. Click "Verify"

### Step 2: Get Nameservers from Netlify
Netlify will show you something like:
```
Use these nameservers:
dns1.p01.nsone.net
dns2.p01.nsone.net
dns3.p01.nsone.net
dns4.p01.nsone.net
```

### Step 3: Update Nameservers at Domain Registrar
1. Go to where you registered `drinksdeliverykenya.com`
2. Find "Nameservers" or "DNS Nameservers" section
3. Replace current nameservers with Netlify's nameservers
4. Save changes

### Step 4: Wait for Propagation
- Usually takes 1-24 hours
- Can check with: `dig drinksdeliverykenya.com NS`

### Step 5: Verify in Netlify
- Netlify will automatically detect when nameservers are updated
- SSL certificate will be issued automatically
- Site will start serving from Netlify

---

## Summary

**Yes, nameservers are enough!** 

If you use **Option 1 (Netlify DNS)**, you only need to:
1. Add domain in Netlify
2. Change nameservers at your domain registrar
3. Wait for propagation

That's it! No need to configure individual DNS records.

If you use **Option 2 (External DNS)**, you need to:
1. Add domain in Netlify
2. Configure specific DNS records (ALIAS/A record + CNAME)
3. Wait for propagation

Both work, but Option 1 is simpler.

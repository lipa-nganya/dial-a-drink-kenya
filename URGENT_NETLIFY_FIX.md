# 🚨 URGENT: Fix Netlify Backend URL for Demo

## Immediate Actions Required (5 minutes)

### Option 1: Manual Netlify Rebuild (FASTEST)

1. **Customer Site** (dialadrink.thewolfgang.tech):
   - Go to: https://app.netlify.com/sites/dialadrink-customer/deploys
   - Click **"Trigger deploy"** → **"Deploy site"**
   - This will rebuild from the latest commit

2. **Admin Site** (dialadrink-admin.thewolfgang.tech):
   - Go to: https://app.netlify.com/sites/dialadrink-admin/deploys
   - Click **"Trigger deploy"** → **"Deploy site"**
   - This will rebuild from the latest commit

3. **Wait 2-3 minutes** for builds to complete

4. **Clear browser cache** or use **Incognito/Private window**:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 or Cmd+Shift+R
   - Safari: Cmd+Option+R

### Option 2: Push Changes and Trigger Rebuild

If you haven't pushed yet:

```bash
# Push the changes
git push origin develop

# Then trigger rebuilds in Netlify (see Option 1)
```

### Option 3: Verify Code is Correct

The code should show:
- `DEFAULT_DEV_API_BASE = 'https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api'`

Check in browser console after rebuild:
```javascript
// Should show:
API_BASE_URL: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api
API source: netlify-dev
```

## If Still Not Working

1. **Check Netlify is using `develop` branch**:
   - Site settings → Build & deploy → Branch to deploy: `develop`

2. **Clear Netlify build cache**:
   - Site settings → Build & deploy → Clear cache and deploy site

3. **Verify backend CORS**:
   - Backend should allow: `https://dialadrink.thewolfgang.tech`
   - Backend should allow: `https://dialadrink-admin.thewolfgang.tech`

## Quick Test

After rebuild, open browser console and check:
```javascript
// Should see:
=== API CONFIGURATION ===
API_BASE_URL: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api
```

If you see the old URL (`deliveryos-backend-p6bkgryxqa`), the rebuild hasn't picked up the changes yet.

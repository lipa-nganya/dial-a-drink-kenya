# Fix: ruakadrinksdelivery.co.ke Using Old Backend

## Problem

The site `https://ruakadrinksdelivery.co.ke` is still using the old backend URL:
- **Current:** `https://deliveryos-backend-910510650031.us-central1.run.app/api`
- **Expected:** `https://deliveryos-backend-805803410802.us-central1.run.app/api`

The API source shows `fallback-production`, indicating the production site detection isn't working.

## Solution

### Code Changes

1. **Improved hostname detection** in `frontend/src/services/api.js`
   - Added exact matching for `ruakadrinksdelivery.co.ke`
   - Added `www.` variant matching
   - Moved production site check to run first (before other checks)

2. **Merged to main branch** - Changes are now on `main` branch

### Next Steps

**Netlify should auto-deploy** from the `main` branch. If it doesn't:

1. **Check Netlify Dashboard:**
   - Go to: https://app.netlify.com/
   - Find the site for `ruakadrinksdelivery.co.ke`
   - Check if it's connected to GitHub
   - Verify branch is set to `main`

2. **Manually Trigger Deployment:**
   - Go to Netlify Dashboard → Site → Deploys
   - Click **"Trigger deploy"** → **"Deploy site"**
   - Select branch: `main`
   - Click **"Deploy"**

3. **Verify After Deployment:**
   - Visit: https://ruakadrinksdelivery.co.ke
   - Open browser console (F12)
   - Check API configuration logs:
     ```
     API_BASE_URL: https://deliveryos-backend-805803410802.us-central1.run.app/api
     API source: production-site
     ```

### Check Netlify Environment Variables

If the site still uses the old URL after deployment, check for environment variables:

1. Go to Netlify Dashboard → Site → Site settings → Environment variables
2. Look for `REACT_APP_PRODUCTION_API_BASE`
3. If it exists and points to the old URL, either:
   - Delete it (to use code default), OR
   - Update it to: `https://deliveryos-backend-805803410802.us-central1.run.app/api`

### Expected Behavior

After deployment, the site should:
- ✅ Detect `ruakadrinksdelivery.co.ke` as a production site
- ✅ Use backend URL: `https://deliveryos-backend-805803410802.us-central1.run.app/api`
- ✅ Show API source: `production-site` (not `fallback-production`)
- ✅ No CORS errors (backend CORS already configured)

### Verification

Once deployed, test:
```bash
# Check API configuration in browser console
# Should show:
# API_BASE_URL: https://deliveryos-backend-805803410802.us-central1.run.app/api
# API source: production-site

# Test API endpoint
curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health
```

---

## Status

- ✅ Code updated and merged to `main`
- ✅ Changes pushed to GitHub
- ⏳ Waiting for Netlify auto-deploy (or manual trigger)

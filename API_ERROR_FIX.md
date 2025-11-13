# Fix: ApiNotActivatedMapError

## Error Message
```
Google Maps JavaScript API error: ApiNotActivatedMapError
```

## What This Means
The **Places API** is not enabled in your Google Cloud Console project. The API key exists, but the required API hasn't been activated.

## Quick Fix (5 minutes)

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project (or create one if needed)

### Step 2: Enable Required APIs
1. Go to **"APIs & Services"** → **"Library"** (or visit: https://console.cloud.google.com/apis/library)
2. Search for **"Places API"** and click on it
3. Click **"Enable"** button
4. Go back to Library
5. Search for **"Maps JavaScript API"** and click on it  
6. Click **"Enable"** button

### Step 3: Wait & Refresh
- Wait 1-2 minutes for APIs to activate
- Refresh your browser page
- The autocomplete should now work!

## Verify APIs Are Enabled

You can check by going to:
**APIs & Services** → **"Enabled APIs"**

You should see:
- ✅ Places API
- ✅ Maps JavaScript API

## Still Not Working?

1. **Check API Key Restrictions**
   - Go to **APIs & Services** → **Credentials**
   - Click on your API key
   - Make sure API restrictions allow "Places API" and "Maps JavaScript API"
   - Or temporarily set to "Don't restrict" for testing

2. **Check Billing**
   - Google Maps requires billing to be enabled (but offers $200 free credit/month)
   - Go to **Billing** and ensure a billing account is linked

3. **Clear Browser Cache**
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

## Cost Note
- **Places Autocomplete**: $2.83 per 1,000 requests
- **$200 free credit/month** = ~70,000 free requests/month
- Very affordable for most applications















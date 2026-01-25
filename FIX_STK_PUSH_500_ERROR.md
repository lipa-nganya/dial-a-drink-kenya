# 🔧 Fix: M-Pesa STK Push 500 Error

## Problem

STK payment initiation was failing with a 500 error on the development backend (`deliveryos-backend-910510650031.us-central1.run.app`).

## Root Cause

The M-Pesa callback URL logic was always using the **production** callback URL when running on Cloud Run, even for the development backend. This caused issues because:

1. The dev backend should use its own callback URL
2. M-Pesa callbacks would go to the wrong backend
3. The STK push request would fail

## Solution

Updated `backend/services/mpesa.js` to detect which Cloud Run instance is running and use the appropriate callback URL:

- **Dev backend** (project `910510650031` or `drink-suite`): Uses `https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback`
- **Production backend** (project `dialadrink-production`): Uses `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/mpesa/callback`

## Changes Made

**File**: `backend/services/mpesa.js`

The callback URL detection now:
1. Checks for explicit `MPESA_CALLBACK_URL` environment variable (highest priority)
2. Checks for `NGROK_URL` environment variable (for local development)
3. Detects Cloud Run instance based on GCP project ID:
   - Project `910510650031` or `drink-suite` → Dev backend callback URL
   - Project `dialadrink-production` → Production callback URL
4. Falls back to production URL if project cannot be determined

## Additional Checks Required

If STK push still fails after deploying this fix, verify:

### 1. M-Pesa Credentials in Cloud Run

Ensure the following environment variables are set in the Cloud Run service:

```bash
MPESA_CONSUMER_KEY=<your-consumer-key>
MPESA_CONSUMER_SECRET=<your-consumer-secret>
MPESA_SHORTCODE=<your-shortcode>
MPESA_PASSKEY=<your-passkey>
MPESA_ENVIRONMENT=sandbox  # or 'production'
```

**To check current environment variables:**
```bash
gcloud run services describe deliveryos-backend \
  --region us-central1 \
  --project 910510650031 \
  --format="value(spec.template.spec.containers[0].env)"
```

**To update environment variables:**
```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project 910510650031 \
  --update-env-vars MPESA_CONSUMER_KEY=<key>,MPESA_CONSUMER_SECRET=<secret>,MPESA_SHORTCODE=<shortcode>,MPESA_PASSKEY=<passkey>
```

### 2. M-Pesa API Access

- Verify M-Pesa API credentials are valid
- Check if using sandbox or production environment
- Ensure the shortcode is properly configured in M-Pesa portal

### 3. Backend Logs

Check Cloud Run logs for detailed error messages:

```bash
gcloud run services logs read deliveryos-backend \
  --region us-central1 \
  --project 910510650031 \
  --limit 50
```

Look for:
- `❌ M-Pesa credentials missing!`
- `❌ Error initiating M-Pesa STK Push:`
- `M-Pesa STK Push error response:`

## Deployment

1. **Commit the fix:**
   ```bash
   git add backend/services/mpesa.js
   git commit -m "Fix: Use correct callback URL for dev backend STK push"
   git push origin develop
   ```

2. **Deploy to dev backend:**
   ```bash
   cd backend
   gcloud builds submit --tag gcr.io/910510650031/deliveryos-backend .
   gcloud run deploy deliveryos-backend \
     --image gcr.io/910510650031/deliveryos-backend \
     --region us-central1 \
     --project 910510650031
   ```

3. **Test STK push:**
   - Try placing an order on the development site
   - Check browser console for any errors
   - Check Cloud Run logs for STK push initiation

## Expected Behavior After Fix

When STK push is initiated:
1. Backend detects it's running on dev Cloud Run (project 910510650031)
2. Uses dev backend callback URL: `https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback`
3. Sends STK push request to M-Pesa API
4. M-Pesa sends callback to the correct dev backend URL
5. Payment is processed successfully

## Verification

After deploying, check the backend logs when initiating STK push. You should see:

```
✅ Using dev backend callback URL: https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback
Sending STK Push request to M-Pesa...
M-Pesa STK Push success response: {...}
```

If you see errors about missing credentials or callback URL issues, refer to the "Additional Checks Required" section above.

# 🚀 Deploy Dev Backend & Verify M-Pesa Credentials

## ✅ Step 1: Fix Committed and Pushed

The STK push callback URL fix has been committed and pushed to the `develop` branch.

## 📋 Step 2: Deploy Dev Backend

Since `gcloud` CLI has system-level issues, deploy using one of these methods:

### Option A: Using GCP Console (Recommended)

1. **Go to Cloud Build**: https://console.cloud.google.com/cloud-build/builds?project=910510650031
2. **Trigger a build**:
   - Click **"Trigger build"** or **"Run trigger"**
   - Select the trigger that builds `deliveryos-backend`
   - Or manually trigger: **"Run trigger"** → Select trigger → **"Run"**

3. **Wait for build to complete** (usually 5-10 minutes)

4. **Deploy to Cloud Run**:
   - Go to: https://console.cloud.google.com/run?project=910510650031
   - Find service: `deliveryos-backend`
   - Click **"Edit & Deploy New Revision"**
   - The new image should be available automatically
   - Click **"Deploy"**

### Option B: Using gcloud CLI (if fixed)

```bash
cd backend
gcloud config set project 910510650031
gcloud builds submit --tag gcr.io/910510650031/deliveryos-backend .
gcloud run deploy deliveryos-backend \
  --image gcr.io/910510650031/deliveryos-backend \
  --region us-central1 \
  --project 910510650031
```

## 🔍 Step 3: Verify M-Pesa Sandbox Credentials

### Check Current Environment Variables

**Using GCP Console:**
1. Go to: https://console.cloud.google.com/run?project=910510650031
2. Click on service: `deliveryos-backend`
3. Click **"Edit & Deploy New Revision"**
4. Scroll to **"Variables & Secrets"** section
5. Check for these environment variables:
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_SHORTCODE`
   - `MPESA_PASSKEY`
   - `MPESA_ENVIRONMENT` (should be `sandbox` for dev)

### Required M-Pesa Sandbox Credentials

For **sandbox** (development), you need:

```env
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=<sandbox-consumer-key>
MPESA_CONSUMER_SECRET=<sandbox-consumer-secret>
MPESA_SHORTCODE=<sandbox-shortcode>
MPESA_PASSKEY=<sandbox-passkey>
```

### Get Sandbox Credentials

1. **Go to M-Pesa Developer Portal**: https://developer.safaricom.co.ke/
2. **Login** with your M-Pesa developer account
3. **Go to "My Apps"** → Select your sandbox app
4. **Copy credentials**:
   - Consumer Key
   - Consumer Secret
   - Shortcode (usually `174379` for sandbox)
   - Passkey (from app settings)

### Set Environment Variables in Cloud Run

**Using GCP Console:**
1. Go to: https://console.cloud.google.com/run?project=910510650031
2. Click on: `deliveryos-backend`
3. Click **"Edit & Deploy New Revision"**
4. Scroll to **"Variables & Secrets"**
5. Click **"Add Variable"** for each:
   - Name: `MPESA_ENVIRONMENT`, Value: `sandbox`
   - Name: `MPESA_CONSUMER_KEY`, Value: `<your-sandbox-consumer-key>`
   - Name: `MPESA_CONSUMER_SECRET`, Value: `<your-sandbox-consumer-secret>`
   - Name: `MPESA_SHORTCODE`, Value: `<your-sandbox-shortcode>` (usually `174379`)
   - Name: `MPESA_PASSKEY`, Value: `<your-sandbox-passkey>`
6. Click **"Deploy"**

**Using gcloud CLI (if working):**
```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project 910510650031 \
  --update-env-vars \
    MPESA_ENVIRONMENT=sandbox,\
    MPESA_CONSUMER_KEY=<your-key>,\
    MPESA_CONSUMER_SECRET=<your-secret>,\
    MPESA_SHORTCODE=<your-shortcode>,\
    MPESA_PASSKEY=<your-passkey>
```

## ✅ Step 4: Verify Deployment

### Check Backend Logs

After deployment, check logs for the callback URL fix:

```bash
# Using gcloud (if working)
gcloud run services logs read deliveryos-backend \
  --region us-central1 \
  --project 910510650031 \
  --limit 50
```

**Or using GCP Console:**
1. Go to: https://console.cloud.google.com/run?project=910510650031
2. Click on: `deliveryos-backend`
3. Click **"Logs"** tab
4. Look for: `✅ Using dev backend callback URL: https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback`

### Test STK Push

1. **Visit development site**: https://dialadrink.thewolfgang.tech/
2. **Add items to cart** and proceed to checkout
3. **Select M-Pesa payment** and submit order
4. **Check browser console** for any errors
5. **Check Cloud Run logs** for STK push initiation

## 🔍 Troubleshooting

### If STK push still fails with 500:

1. **Check logs for credential errors**:
   - Look for: `❌ M-Pesa credentials missing!`
   - Verify all 4 credentials are set

2. **Check callback URL in logs**:
   - Should show: `✅ Using dev backend callback URL: ...`
   - If it shows production URL, the fix didn't deploy

3. **Verify M-Pesa API access**:
   - Check if sandbox credentials are valid
   - Verify shortcode and passkey match

4. **Check M-Pesa API response**:
   - Look for: `M-Pesa STK Push error response:`
   - This will show the actual M-Pesa API error

### Common Issues:

- **Missing credentials**: Set all 4 M-Pesa environment variables
- **Wrong environment**: Ensure `MPESA_ENVIRONMENT=sandbox` for dev
- **Invalid credentials**: Verify credentials in M-Pesa developer portal
- **Callback URL still wrong**: Ensure new code is deployed (check revision number)

## 📝 Summary

After completing these steps:
- ✅ Fix is deployed to dev backend
- ✅ M-Pesa sandbox credentials are configured
- ✅ Callback URL points to dev backend
- ✅ STK push should work correctly

Test by placing an order and initiating M-Pesa payment.

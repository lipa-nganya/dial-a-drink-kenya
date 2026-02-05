# 🚀 Deploy Dev Backend with M-Pesa Credentials

## M-Pesa Sandbox Credentials

```
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=FHZFIBqOrkVQRROotlEhiit3LWycwhsg2GgIxeS1BaE46Ecf
MPESA_CONSUMER_SECRET=BDosKnRkJOXzY2oIeAMp12g5mQHxjkPCA1k5drdUmrqsd2A9W3APkmgx5ThkLjws
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

## Step 1: Authenticate with Correct Account

If you need to switch accounts:

```bash
gcloud auth login <your-dev-account-email>
gcloud config set project drink-suite
```

## Step 2: Build Backend Image

```bash
cd backend
gcloud builds submit --tag gcr.io/drink-suite/deliveryos-backend
```

This will:
- Build the Docker image from the current code
- Push it to Google Container Registry
- Include the STK push callback URL fix

## Step 3: Update M-Pesa Credentials

```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --update-env-vars \
    MPESA_ENVIRONMENT=sandbox,\
    MPESA_CONSUMER_KEY=FHZFIBqOrkVQRROotlEhiit3LWycwhsg2GgIxeS1BaE46Ecf,\
    MPESA_CONSUMER_SECRET=BDosKnRkJOXzY2oIeAMp12g5mQHxjkPCA1k5drdUmrqsd2A9W3APkmgx5ThkLjws,\
    MPESA_SHORTCODE=174379,\
    MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

## Step 4: Deploy New Image

```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --image gcr.io/drink-suite/deliveryos-backend:latest
```

## Step 5: Verify Deployment

### Check Environment Variables

```bash
gcloud run services describe deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --format="get(spec.template.spec.containers[0].env)" | grep -i mpesa
```

Should show all 5 M-Pesa environment variables.

### Check Logs

```bash
gcloud run services logs read deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --limit 50
```

Look for:
- `✅ Using dev backend callback URL: https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback`
- No errors about missing M-Pesa credentials

## Alternative: Using GCP Console

If CLI permissions are an issue, use the GCP Console:

### 1. Build Image

1. Go to: https://console.cloud.google.com/cloud-build/builds?project=drink-suite
2. Click **"Trigger build"** or **"Run trigger"**
3. Select the trigger for `deliveryos-backend`
4. Set branch to `develop`
5. Click **"Run"**

### 2. Set M-Pesa Credentials

1. Go to: https://console.cloud.google.com/run?project=drink-suite
2. Click on: `deliveryos-backend`
3. Click **"Edit & Deploy New Revision"**
4. Scroll to **"Variables & Secrets"**
5. Add/Update these variables:
   - `MPESA_ENVIRONMENT` = `sandbox`
   - `MPESA_CONSUMER_KEY` = `FHZFIBqOrkVQRROotlEhiit3LWycwhsg2GgIxeS1BaE46Ecf`
   - `MPESA_CONSUMER_SECRET` = `BDosKnRkJOXzY2oIeAMp12g5mQHxjkPCA1k5drdUmrqsd2A9W3APkmgx5ThkLjws`
   - `MPESA_SHORTCODE` = `174379`
   - `MPESA_PASSKEY` = `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
6. Click **"Deploy"**

### 3. Update Image (if needed)

1. In the same **"Edit & Deploy New Revision"** page
2. Under **"Container"**, select the latest image
3. Click **"Deploy"**

## Testing

After deployment:

1. Visit: https://dialadrink.thewolfgang.tech/
2. Add items to cart
3. Proceed to checkout
4. Select M-Pesa payment
5. Submit order

**Expected behavior:**
- STK push should initiate successfully
- No 500 errors
- CheckoutRequestID should be returned
- Payment prompt should appear on phone (if using real M-Pesa, not sandbox)

**Check logs for:**
```
✅ Using dev backend callback URL: https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback
M-Pesa STK Push success response: {...}
```

## Troubleshooting

### Still getting 500 error?

1. **Check credentials are set:**
   ```bash
   gcloud run services describe deliveryos-backend \
     --region us-central1 \
     --project drink-suite \
     --format="get(spec.template.spec.containers[0].env)" | grep MPESA
   ```

2. **Check logs for errors:**
   ```bash
   gcloud run services logs read deliveryos-backend \
     --region us-central1 \
     --project drink-suite \
     --limit 100 | grep -i "error\|mpesa\|stk"
   ```

3. **Verify callback URL in logs:**
   - Should show dev backend URL, not production
   - If it shows production, the fix didn't deploy

4. **Check M-Pesa API response:**
   - Look for `M-Pesa STK Push error response:` in logs
   - This will show the actual M-Pesa API error

### Credentials not saving?

- Ensure you're updating the correct service
- Check project is `drink-suite` (not production)
- Verify you have Editor or Owner role on the project

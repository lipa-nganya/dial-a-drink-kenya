# 🔧 Backend Deployment Fix - Cloud Run Startup Issues

## ❌ Error

```
The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

## ✅ Fixes Applied

1. **Server now listens on `0.0.0.0:8080`** (required for Cloud Run)
2. **Improved error handling** - Server won't crash on DB connection failures
3. **Better logging** - Shows environment and port configuration

## 🚀 Redeploy Backend

The fixes are pushed to GitHub. If you have Cloud Build triggers set up, they will auto-deploy. Otherwise, deploy manually:

```bash
cd backend

# Build and deploy
gcloud builds submit --tag gcr.io/drink-suite/dialadrink-backend .
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,PORT=8080"
```

## ⚠️ Important: Set Environment Variables

Before deploying, make sure these environment variables are set in Cloud Run:

### Required Variables

```bash
gcloud run services update dialadrink-backend \
  --region us-central1 \
  --update-env-vars "DATABASE_URL=[YOUR_CLOUD_SQL_URL],MPESA_CONSUMER_KEY=[YOUR_KEY],MPESA_CONSUMER_SECRET=[YOUR_SECRET],MPESA_SHORTCODE=174379,MPESA_PASSKEY=[YOUR_PASSKEY],MPESA_ENVIRONMENT=sandbox,FORCE_REAL_MPESA=true"
```

**Replace placeholders**:
- `[YOUR_CLOUD_SQL_URL]` - Your Cloud SQL connection string
- `[YOUR_KEY]` - M-Pesa consumer key
- `[YOUR_SECRET]` - M-Pesa consumer secret  
- `[YOUR_PASSKEY]` - M-Pesa passkey

### Set Variables via Console

1. Go to: https://console.cloud.google.com/run
2. Click on `dialadrink-backend`
3. Click **"Edit & Deploy New Revision"**
4. Go to **"Variables & Secrets"** tab
5. Add/Update environment variables:
   - `DATABASE_URL`
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_SHORTCODE` = `174379`
   - `MPESA_PASSKEY`
   - `MPESA_ENVIRONMENT` = `sandbox`
   - `FORCE_REAL_MPESA` = `true`
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
6. Click **"Deploy"**

## 🔍 Troubleshooting

### Check Cloud Run Logs

```bash
# View recent logs
gcloud run services logs read dialadrink-backend \
  --region us-central1 \
  --limit 50
```

Or visit: https://console.cloud.google.com/run/detail/us-central1/dialadrink-backend/logs

### Common Issues

1. **Missing DATABASE_URL**
   - Error: Database connection fails
   - Fix: Set `DATABASE_URL` environment variable

2. **Missing M-Pesa Credentials**
   - Error: Server crashes on startup (if validation is strict)
   - Fix: Set all `MPESA_*` environment variables

3. **Port Not Listening**
   - Error: Container timeout
   - Fix: ✅ Already fixed - server now listens on `0.0.0.0:8080`

4. **Database Connection Timeout**
   - Error: Slow startup
   - Fix: ✅ Already fixed - server continues even if DB fails initially

## ✅ Verify Deployment

After deployment, test the health endpoint:

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe dialadrink-backend \
  --region us-central1 \
  --format="value(status.url)")

# Test health endpoint
curl ${SERVICE_URL}/api/health
```

Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

## 📝 Next Steps

1. ✅ Set all environment variables (especially `DATABASE_URL`)
2. ✅ Redeploy backend with new code
3. ✅ Check logs if deployment still fails
4. ✅ Verify health endpoint responds


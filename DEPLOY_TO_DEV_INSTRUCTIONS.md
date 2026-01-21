# 🚀 Deploy All Services to Dev Environment

This guide covers deploying all services (backend, customer frontend, admin frontend, driver app) to the dev environment.

## Prerequisites

1. **Google Cloud SDK** installed and authenticated
2. **Node.js** and **npm** installed
3. **Android Studio** installed (for driver app builds)
4. **Access** to `drink-suite` GCP project

## Quick Deploy

Run the automated deployment script:

```bash
./deploy-all-to-dev.sh
```

This will:
- ✅ Deploy backend with PesaPal credentials
- ✅ Deploy customer frontend
- ✅ Deploy admin frontend
- ✅ Provide PesaPal dashboard configuration URLs
- ✅ Provide driver app build instructions

## Manual Deployment Steps

### 1. Backend Deployment

```bash
cd backend
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and deploy
gcloud builds submit --tag gcr.io/drink-suite/deliveryos-backend .
gcloud run deploy deliveryos-backend \
  --image gcr.io/drink-suite/deliveryos-backend \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "NODE_ENV=production,PESAPAL_CONSUMER_KEY=UDLDp9yShy4g0aLPNhT+2kZSX3L+KdsF,PESAPAL_CONSUMER_SECRET=XeRwDyreZTPde0H3AWlIiStXZD8=,PESAPAL_ENVIRONMENT=sandbox,CUSTOMER_FRONTEND_URL=https://deliveryos-customer-910510650031.us-central1.run.app" \
  --memory 512Mi \
  --timeout 300 \
  --add-cloudsql-instances "drink-suite:us-central1:drink-suite-db"
```

**Backend URL:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`

### 2. Customer Frontend Deployment

```bash
cd frontend
npm install
npm run build

gcloud run deploy deliveryos-customer \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api" \
  --memory 256Mi
```

**Customer Site URL:** `https://deliveryos-customer-910510650031.us-central1.run.app`

### 3. Admin Frontend Deployment

```bash
cd admin-frontend
npm install
npm run build

gcloud run deploy deliveryos-admin \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api" \
  --memory 256Mi
```

**Admin Dashboard URL:** `https://deliveryos-admin-910510650031.us-central1.run.app`

### 4. Database Migrations

Run migrations to ensure all tables and columns are up to date:

```bash
# Option 1: Via Cloud Run Job (Recommended)
./backend/scripts/run-migrations-via-cloud-run.sh

# Option 2: Directly via Cloud SQL Proxy
./backend/scripts/run-migrations-cloud-sql.sh
```

**Note:** The Transaction model already has all required fields for PesaPal (`paymentProvider`, `paymentMethod`), so no new migrations are needed for PesaPal integration.

### 5. Driver App Build

1. Open **Android Studio**
2. Open project: `driver-app-native`
3. **Build Variant:** Select `developmentDebug`
4. **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. The APK will be generated in: `driver-app-native/app/build/outputs/apk/development/debug/`

The app will automatically use the dev backend API URL: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

## PesaPal Dashboard Configuration

After deployment, configure PesaPal IPN settings:

1. Go to: **https://developer.pesapal.com/**
2. Navigate to: **Settings > IPN Settings** (in the **Production** credentials section)
3. Configure:

   **Website Domain:**
   ```
   https://deliveryos-customer-910510650031.us-central1.run.app
   ```

   **IPN Listener URL:**
   ```
   https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
   ```

4. Set **IPN Notification Type**: `GET`
5. Save the configuration

## Environment Variables

### Backend Environment Variables (Dev)

- `NODE_ENV=production`
- `PESAPAL_CONSUMER_KEY=UDLDp9yShy4g0aLPNhT+2kZSX3L+KdsF`
- `PESAPAL_CONSUMER_SECRET=XeRwDyreZTPde0H3AWlIiStXZD8=`
- `PESAPAL_ENVIRONMENT=sandbox`
- `CUSTOMER_FRONTEND_URL=https://deliveryos-customer-910510650031.us-central1.run.app`

### Frontend Environment Variables

- `REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

## Verification

After deployment, verify all services:

1. **Backend Health Check:**
   ```bash
   curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
   ```

2. **Customer Site:**
   - Visit: `https://deliveryos-customer-910510650031.us-central1.run.app`
   - Verify API calls work

3. **Admin Dashboard:**
   - Visit: `https://deliveryos-admin-910510650031.us-central1.run.app`
   - Verify API calls work

4. **PesaPal Integration:**
   - Test a card payment on the customer site
   - Verify IPN callbacks are received in backend logs

## Troubleshooting

### Backend Deployment Issues

- Check Cloud Run logs: `gcloud run services logs read deliveryos-backend --limit 50`
- Verify environment variables: `gcloud run services describe deliveryos-backend --format="value(spec.template.spec.containers[0].env)"`

### Frontend Deployment Issues

- Check build logs for errors
- Verify `REACT_APP_API_URL` is set correctly
- Check browser console for API connection errors

### PesaPal IPN Not Working

- Verify IPN URL is configured in PesaPal dashboard (Production section)
- Check backend logs for IPN callbacks: `gcloud run services logs read deliveryos-backend --limit 100 | grep pesapal`
- Ensure backend URL is accessible from internet

## API URLs (Maintained)

All services maintain the existing API URLs:

- **Backend API:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
- **Customer Site:** `https://deliveryos-customer-910510650031.us-central1.run.app`
- **Admin Dashboard:** `https://deliveryos-admin-910510650031.us-central1.run.app`

These URLs are hardcoded in the frontend `backendUrl.js` files and will automatically detect the correct backend based on the hostname.

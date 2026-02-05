# 🚀 Dial A Drink Production Setup Guide

Complete guide for setting up the production environment for Dial A Drink.

## Prerequisites

1. **Google Cloud Account**: `dialadrinkkenya254@gmail.com`
2. **GitHub Account**: Same as development (no change)
3. **Git Branch Setup**: `main` branch for production, `develop` for development
   - See `SETUP_GIT_BRANCHES.md` for branch setup instructions
4. **Netlify Account**: Separate production account (to be created)
5. **Android Studio**: For building production APK/AAB

## Overview

### Branch Structure

- **`develop`** branch → Development environment
  - Customer site: https://dialadrink.thewolfgang.tech/
  - Admin site: https://dialadrink-admin.thewolfgang.tech/
  - Backend: GCP project `910510650031` (drink-suite)
  - Android: Development build variant

- **`main`** branch → Production environment
  - Customer site: (Production Netlify URL)
  - Admin site: (Production Netlify URL)
  - Backend: GCP project `dialadrink-production`
  - Android: Production build variant

### Production Setup Includes:
1. ✅ Google Cloud Platform project and services
2. ✅ Cloud SQL production database
3. ✅ Cloud Run backend service
4. ✅ Netlify production sites (customer & admin)
5. ✅ Android production app build

## Step 0: Set Up Git Branches (If Not Done)

Before setting up production, ensure your Git branches are configured:

- **`develop`** branch → Development environment
  - Customer: https://dialadrink.thewolfgang.tech/
  - Admin: https://dialadrink-admin.thewolfgang.tech/
  - Backend: GCP project `910510650031` (drink-suite)
  - Android: Development build

- **`main`** branch → Production environment
  - Customer: (Production Netlify URL)
  - Admin: (Production Netlify URL)
  - Backend: GCP project `dialadrink-production`
  - Android: Production build

**Quick Setup:**
```bash
chmod +x setup-production-branches.sh
./setup-production-branches.sh
```

**Or manually:** See `SETUP_GIT_BRANCHES.md` for detailed instructions.

**Important**: 
- Development Netlify deployments must use `develop` branch
- Production Netlify deployments must use `main` branch
- See `DEVELOPMENT_BRANCH_SETUP.md` for development configuration

## Step 1: Google Cloud Platform Setup

### 1.1 Authenticate with GCP

```bash
gcloud auth login dialadrinkkenya254@gmail.com
```

### 1.2 Run Production Setup Script

```bash
chmod +x setup-production.sh
./setup-production.sh
```

This script will:
- Create/verify GCP project (`dialadrink-production`)
- Enable required APIs
- Create Cloud SQL instance
- Create database and user
- Generate secure password
- Save configuration to `production-config.env`

**⚠️ Important**: Save the database password securely! It will be shown during setup.

### 1.3 Link Billing Account

The script will prompt you to link a billing account. Visit:
```
https://console.cloud.google.com/billing?project=dialadrink-production
```

Link your billing account, then press Enter in the terminal to continue.

## Step 2: Run Database Migrations

After Cloud SQL is set up, run migrations:

```bash
chmod +x backend/scripts/run-production-migrations.sh
./backend/scripts/run-production-migrations.sh
```

This will:
- Connect to production database
- Run all necessary migrations
- Add required columns (e.g., `cashAtHand`)

## Step 3: Deploy Backend to Production

### 3.1 Deploy Backend Service

```bash
chmod +x deploy-backend-production.sh
./deploy-backend-production.sh
```

This will:
- Build Docker image
- Push to Container Registry
- Deploy to Cloud Run
- Configure Cloud SQL connection
- Set basic environment variables

### 3.2 Configure Production Secrets

After initial deployment, configure production secrets:

```bash
# Get the service URL first
SERVICE_URL=$(gcloud run services describe dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --format "value(status.url)")

# Update with production secrets
gcloud run services update dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --update-env-vars "PESAPAL_CONSUMER_KEY=<PRODUCTION_KEY>" \
    --update-env-vars "PESAPAL_CONSUMER_SECRET=<PRODUCTION_SECRET>" \
    --update-env-vars "PESAPAL_ENVIRONMENT=live" \
    --update-env-vars "FRONTEND_URL=<CUSTOMER_PRODUCTION_URL>" \
    --update-env-vars "ADMIN_URL=<ADMIN_PRODUCTION_URL>"
```

**Required Environment Variables:**
- `PESAPAL_CONSUMER_KEY` - Production PesaPal consumer key
- `PESAPAL_CONSUMER_SECRET` - Production PesaPal consumer secret
- `PESAPAL_ENVIRONMENT=live` - Use live PesaPal environment
- `FRONTEND_URL` - Customer frontend production URL (from Netlify)
- `ADMIN_URL` - Admin frontend production URL (from Netlify)
- `DATABASE_URL` - Already set by deployment script

### 3.3 Test Backend

```bash
curl https://<SERVICE_URL>/api/health
```

Should return: `{"status":"ok"}`

## Step 4: Set Up Netlify Production Sites

### 4.1 Login to Netlify Production Account

**Production Netlify Account:**
- Email: `dialadrinkkenya254@gmail.com`
- Password: `Malibu2026.`

**Quick Setup Script:**
```bash
chmod +x setup-netlify-production.sh
./setup-netlify-production.sh
```

**Or Manual Login:**

**Via Web:**
1. Go to [Netlify](https://app.netlify.com)
2. Click "Log in"
3. Enter email: `dialadrinkkenya254@gmail.com`
4. Enter password: `Malibu2026.`

**Via CLI (for automated deployments):**
```bash
netlify login
# When prompted:
# Email: dialadrinkkenya254@gmail.com
# Password: Malibu2026.
```

**Note:** This is a separate account from the development Netlify account.

### 4.2 Deploy Customer Frontend

1. **Connect GitHub Repository:**
   - Go to Netlify Dashboard
   - Click "Add new site" → "Import an existing project"
   - Select "GitHub" → Authorize
   - Select repository: `dial-a-drink-kenya` (or your repo name)
   - **Select branch: `main`** (production branch)

2. **Configure Build Settings:**
   - **Base directory**: `frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `frontend/build`

3. **Set Environment Variables:**
   ```
   REACT_APP_API_URL=https://<BACKEND_SERVICE_URL>/api
   REACT_APP_ENVIRONMENT=production
   ```

4. **Deploy:**
   - Click "Deploy site"
   - Wait for build to complete
   - Note the production URL (e.g., `https://dialadrink-kenya.netlify.app`)

### 4.3 Deploy Admin Frontend

1. **Add Another Site:**
   - Click "Add new site" again
   - Select same repository
   - **Select branch: `main`** (production branch)

2. **Configure Build Settings:**
   - **Base directory**: `admin-frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `admin-frontend/build`

3. **Set Environment Variables:**
   - Click "Show advanced" → "New variable"
   - Add: `REACT_APP_API_URL` = `https://<BACKEND_SERVICE_URL>/api`
   - Add: `REACT_APP_ENVIRONMENT` = `production`
   - Replace `<BACKEND_SERVICE_URL>` with your production backend URL

4. **Deploy:**
   - Click "Deploy site"
   - Wait for build to complete
   - Note the admin production URL

### 4.4 Configure Custom Domains (Optional)

If you have custom domains:
1. Go to Site settings → Domain management
2. Add custom domain
3. Configure DNS records as instructed
4. Enable SSL (automatic)

### 4.5 Update Backend CORS

After Netlify sites are deployed, update backend CORS:

```bash
gcloud run services update dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --update-env-vars "FRONTEND_URL=<CUSTOMER_NETLIFY_URL>" \
    --update-env-vars "ADMIN_URL=<ADMIN_NETLIFY_URL>"
```

## Step 5: Build Android Production App

### 5.1 Update Production API URL

Edit `driver-app-native/gradle.properties`:

```properties
PROD_API_BASE_URL=https://<BACKEND_SERVICE_URL>/api
```

### 5.2 Build Production APK

```bash
chmod +x build-android-production.sh
./build-android-production.sh
```

This will:
- Clean previous builds
- Build production release APK
- Build production AAB (for Play Store)
- Output locations:
  - APK: `driver-app-native/app/build/outputs/apk/production/release/app-production-release.apk`
  - AAB: `driver-app-native/app/build/outputs/bundle/productionRelease/app-production-release.aab`

### 5.3 Sign APK (Optional)

For distribution outside Play Store:

```bash
cd driver-app-native
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore <KEYSTORE_PATH> \
    app/build/outputs/apk/production/release/app-production-release.apk \
    <KEY_ALIAS>
```

### 5.4 Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app (if not exists)
3. Upload AAB file
4. Configure app signing
5. Complete store listing
6. Submit for review

## Step 6: Configure PesaPal Production

### 6.1 Get Production Credentials

1. Log in to [PesaPal Dashboard](https://developer.pesapal.com/)
2. Switch to **Live** environment
3. Get Consumer Key and Consumer Secret
4. Update backend environment variables (see Step 3.2)

### 6.2 Configure IPN Settings

1. Go to PesaPal Dashboard → Settings → IPN Settings
2. **Website Domain**: Your customer frontend URL
3. **IPN Listener URL**: `https://<BACKEND_SERVICE_URL>/api/pesapal/ipn`
4. Save settings

## Step 7: Verify Production Setup

### 7.1 Test Customer Frontend

1. Visit customer frontend URL
2. Test registration/login
3. Test order placement
4. Test payment flow

### 7.2 Test Admin Frontend

1. Visit admin frontend URL
2. Test admin login
3. Test order management
4. Test cash at hand features

### 7.3 Test Driver App

1. Install production APK on device
2. Test driver login
3. Test order acceptance
4. Test order updates
5. Test cash submissions

### 7.4 Monitor Logs

```bash
# Backend logs
gcloud run services logs read dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --limit 50

# Cloud SQL logs
gcloud sql operations list \
    --instance dialadrink-db-prod \
    --project dialadrink-production
```

## Production Configuration Summary

After setup, you should have:

### URLs
- **Backend API**: `https://<SERVICE_URL>/api`
- **Customer Frontend**: `https://<CUSTOMER_NETLIFY_URL>`
- **Admin Frontend**: `https://<ADMIN_NETLIFY_URL>`

### Database
- **Instance**: `dialadrink-db-prod`
- **Database**: `dialadrink_prod`
- **User**: `dialadrink_app`
- **Password**: (saved in `production-config.env`)

### Services
- **Cloud Run**: `dialadrink-backend-prod`
- **Cloud SQL**: `dialadrink-db-prod`
- **Container Registry**: `gcr.io/dialadrink-production/`

## Security Checklist

- [ ] Database password is secure and stored safely
- [ ] Production secrets are in Secret Manager (recommended)
- [ ] CORS is configured correctly
- [ ] SSL/HTTPS is enabled on all services
- [ ] API keys are production keys (not sandbox)
- [ ] Environment variables are set correctly
- [ ] Backend is not publicly accessible without authentication (if needed)

## Cost Optimization

- Use `db-f1-micro` for Cloud SQL (can upgrade later)
- Set Cloud Run min instances to 0 (pay per request)
- Enable auto-pause for Cloud SQL (if using serverless)
- Monitor usage in Cloud Console

## Troubleshooting

### Backend won't connect to database

1. Check Cloud SQL instance is running
2. Verify connection name is correct
3. Check service account has `roles/cloudsql.client`
4. Verify DATABASE_URL format

### Frontend can't connect to backend

1. Check CORS configuration in backend
2. Verify FRONTEND_URL and ADMIN_URL are set
3. Check backend service is running
4. Verify API URL in frontend environment variables

### Android app can't connect

1. Check PROD_API_BASE_URL in gradle.properties
2. Verify backend is accessible from mobile network
3. Check SSL certificate is valid
4. Verify API endpoints are correct

## Next Steps

1. Set up monitoring and alerts
2. Configure backup schedules
3. Set up CI/CD for automatic deployments
4. Configure custom domains
5. Set up analytics
6. Configure error tracking (Sentry, etc.)

## Support

For issues or questions:
1. Check logs in Cloud Console
2. Review Netlify build logs
3. Check Android Studio build output
4. Review this guide for common issues

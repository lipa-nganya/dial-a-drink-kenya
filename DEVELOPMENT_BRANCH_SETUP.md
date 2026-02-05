# 🔧 Development Branch Setup

This document ensures all development services are properly linked to the `develop` branch.

## Development Environment Overview

All development services should deploy from the **`develop`** branch:

- **Customer Frontend**: https://dialadrink.thewolfgang.tech/
- **Admin Frontend**: https://dialadrink-admin.thewolfgang.tech/
- **Backend API**: GCP project `910510650031` (drink-suite)
- **Android App**: Development build variant

## Step 1: Verify Git Branch Structure

Ensure you have both branches:

```bash
git branch -a
# Should show:
# * develop (current development branch)
#   main (production branch)
```

If `develop` doesn't exist, see `SETUP_GIT_BRANCHES.md` for setup instructions.

## Step 2: Configure Netlify Development Sites

### Customer Site (dialadrink.thewolfgang.tech)

1. Go to Netlify Dashboard
2. Select the customer site (dialadrink.thewolfgang.tech)
3. Go to **Site settings** → **Build & deploy**
4. Under **Continuous Deployment**:
   - **Branch to deploy**: `develop`
   - **Base directory**: `frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `frontend/build`
5. Save changes

### Admin Site (dialadrink-admin.thewolfgang.tech)

1. Go to Netlify Dashboard
2. Select the admin site (dialadrink-admin.thewolfgang.tech)
3. Go to **Site settings** → **Build & deploy**
4. Under **Continuous Deployment**:
   - **Branch to deploy**: `develop`
   - **Base directory**: `admin-frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `admin-frontend/build`
5. Save changes

## Step 3: Configure Cloud Build Triggers (Development)

If using Cloud Build for automatic deployments:

### Development Backend Trigger

```bash
gcloud builds triggers create github \
    --name="deploy-backend-dev" \
    --repo-name="dial-a-drink-kenya" \
    --repo-owner="lipa-nganya" \
    --branch-pattern="^develop$" \
    --build-config=backend/cloudbuild.yaml \
    --project=910510650031 \
    --region=us-central1
```

Or configure via Cloud Console:
1. Go to: https://console.cloud.google.com/cloud-build/triggers?project=910510650031
2. Create trigger:
   - **Name**: `deploy-backend-dev`
   - **Event**: Push to a branch
   - **Branch**: `^develop$` (regex)
   - **Configuration**: `backend/cloudbuild.yaml`

## Step 4: Verify Development Backend Configuration

The development backend should:
- Use GCP project: `910510650031` (drink-suite)
- Deploy from `develop` branch
- Use development database: `drink-suite-db`
- Use development environment variables

Check current configuration:

```bash
gcloud run services describe deliveryos-backend \
    --region=us-central1 \
    --project=910510650031 \
    --format="value(spec.template.spec.containers[0].env)"
```

## Step 5: Android Development Build

The Android app should use the `development` build variant which:
- Uses `developmentDebug` or `developmentRelease` flavor
- Connects to development API: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
- Has package ID: `com.dialadrink.driver.dev`

### Build Development APK

```bash
cd driver-app-native
./gradlew assembleDevelopmentDebug
```

Output: `app/build/outputs/apk/development/debug/app-development-debug.apk`

### Verify API URL

Check `driver-app-native/gradle.properties`:

```properties
DEV_API_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

## Step 6: Update Development Deployment Scripts

Ensure development deployment scripts use `develop` branch:

### deploy-all-to-dev.sh

This script should:
- Deploy from `develop` branch
- Use GCP project: `910510650031`
- Use development environment variables

### Manual Deployment

When deploying manually:

```bash
# Ensure you're on develop branch
git checkout develop
git pull origin develop

# Deploy backend
cd backend
gcloud config set project 910510650031
gcloud builds submit --tag gcr.io/910510650031/deliveryos-backend .
gcloud run deploy deliveryos-backend \
    --image gcr.io/910510650031/deliveryos-backend \
    --region us-central1 \
    --project 910510650031
```

## Verification Checklist

- [ ] `develop` branch exists and is up to date
- [ ] Customer Netlify site deploys from `develop` branch
- [ ] Admin Netlify site deploys from `develop` branch
- [ ] Cloud Build triggers use `develop` branch (if configured)
- [ ] Backend uses GCP project `910510650031`
- [ ] Android development build uses development API URL
- [ ] All development services are accessible and working

## Testing Development Deployment

1. **Make a test change:**
   ```bash
   git checkout develop
   # Make a small change (e.g., add a comment)
   git commit -m "test: Verify develop branch deployment"
   git push origin develop
   ```

2. **Verify deployments:**
   - Check Netlify dashboard for new deployments
   - Check Cloud Build dashboard for backend deployment (if configured)
   - Verify changes appear on development sites

3. **Test Android app:**
   - Build development APK
   - Install on device
   - Verify it connects to development API

## Troubleshooting

### Netlify not deploying from develop

1. Check branch setting in Netlify dashboard
2. Verify GitHub connection is active
3. Check build logs for errors
4. Ensure `develop` branch exists on GitHub

### Backend not updating

1. Verify Cloud Build trigger uses `develop` branch
2. Check trigger is active
3. Review Cloud Build logs
4. Verify GCP project is correct (`910510650031`)

### Android app connecting to wrong API

1. Check `gradle.properties` for `DEV_API_BASE_URL`
2. Verify build variant is `developmentDebug` or `developmentRelease`
3. Rebuild app after changing API URL
4. Check app logs for actual API URL being used

## Summary

All development services should:
- ✅ Deploy from `develop` branch
- ✅ Use GCP project `910510650031` (drink-suite)
- ✅ Use development database and environment variables
- ✅ Be accessible at development URLs

Production services will:
- ✅ Deploy from `main` branch
- ✅ Use GCP project `dialadrink-production`
- ✅ Use production database and environment variables
- ✅ Be accessible at production URLs

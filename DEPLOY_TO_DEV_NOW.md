# Deploy to Development - Step by Step Guide

## Overview
This guide will help you deploy all changes from local to the development environment.

## Prerequisites
- Google Cloud SDK installed and authenticated
- Access to `dialadrinkkenya254@gmail.com` account
- Git configured with repository access

## Deployment Steps

### Step 1: Authenticate with Google Cloud
```bash
gcloud auth login dialadrinkkenya254@gmail.com
gcloud config set project dialadrink-production
```

### Step 2: Commit and Push Changes to GitHub
```bash
# Stage all changes
git add -A

# Commit changes
git commit -m "Deploy to development: Add shop agent push notifications, inventory check improvements, and bug fixes"

# Switch to develop branch
git checkout develop || git checkout -b develop

# Merge main into develop (if needed)
git merge main --no-edit

# Push to GitHub (triggers Netlify auto-deployment)
git push origin develop
```

### Step 3: Database Migration
The `pushToken` column will be added automatically when the backend server starts via the `addMissingColumns()` function in `backend/server.js`. This is idempotent and safe.

**Note:** The migration runs automatically on server startup, so no manual migration is needed.

### Step 4: Deploy Backend to Google Cloud Run

```bash
cd backend

# Build and deploy
gcloud builds submit --tag gcr.io/dialadrink-production/deliveryos-backend-dev .

# Deploy to Cloud Run (preserving existing environment variables)
gcloud run deploy deliveryos-development-backend \
    --image gcr.io/dialadrink-production/deliveryos-backend-dev \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances dialadrink-production:us-central1:dialadrink-db-dev \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev,FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech,GOOGLE_CLOUD_PROJECT=dialadrink-production,GCP_PROJECT=dialadrink-production,HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project dialadrink-production

cd ..
```

### Step 5: Verify Deployment

1. **Check Backend Health:**
   ```bash
   curl https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api/health
   ```

2. **Check Netlify Deployment:**
   - Visit Netlify dashboard
   - Frontend sites will auto-deploy from GitHub `develop` branch

3. **Verify CORS:**
   - CORS is already configured in `backend/app.js`
   - Allowed origins include:
     - `https://dialadrink.thewolfgang.tech` (Customer)
     - `https://dialadrink-admin.thewolfgang.tech` (Admin)
     - `https://*.netlify.app` (Netlify previews)
     - Local development URLs

### Step 6: Build Android App (Optional)

```bash
cd driver-app-native
./gradlew assembleDevelopmentDebug
```

APK will be at:
- `app/build/outputs/apk/development/debug/app-development-debug.apk`

## Automated Deployment

You can also use the automated script:

```bash
./deploy-to-development.sh
```

This script will:
- ✅ Set up gcloud authentication
- ✅ Commit and push changes to GitHub
- ✅ Deploy backend to Cloud Run
- ✅ Preserve CORS configuration
- ✅ Provide Android build instructions

## Important Notes

1. **Frontend Services:** Frontend services are on Netlify and will automatically deploy when you push to GitHub `develop` branch. No manual deployment needed.

2. **Backend Service:** The service `deliveryos-development-backend` already exists on Cloud Run. The script will update it, not create a new one.

3. **Database Migration:** The `pushToken` column migration runs automatically on server startup. No manual migration needed.

4. **CORS:** CORS is maintained automatically. The configuration in `backend/app.js` includes all necessary origins.

5. **Android App:** The Android app code is pushed to GitHub. Build the APK manually when needed.

## Troubleshooting

### If gcloud authentication fails:
```bash
gcloud auth login dialadrinkkenya254@gmail.com
gcloud auth application-default login
```

### If Cloud Build fails:
- Check that you have the necessary permissions
- Verify the project ID is correct: `dialadrink-production`

### If database migration fails:
- The migration runs automatically on server start
- Check backend logs after deployment
- The `addMissingColumns()` function will add the column if missing

### If CORS issues occur:
- Verify `FRONTEND_URL` and `ADMIN_URL` environment variables are set correctly
- Check backend logs for CORS errors
- Ensure allowed origins in `backend/app.js` include your frontend URLs

## Deployment Summary

After deployment, you should have:

✅ Backend deployed to: `deliveryos-development-backend`  
✅ Database migration: `pushToken` column (added automatically)  
✅ CORS: Maintained and configured  
✅ Frontend: Auto-deployed via Netlify from GitHub  
✅ Android: Code pushed to GitHub (build manually when needed)

## Service URLs

- **Backend:** `https://deliveryos-development-backend-lssctajjoq-uc.a.run.app`
- **Customer Frontend:** `https://dialadrink.thewolfgang.tech`
- **Admin Frontend:** `https://dialadrink-admin.thewolfgang.tech`

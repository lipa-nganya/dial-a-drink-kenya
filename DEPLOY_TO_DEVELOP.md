# Deploy to Develop Environment

This guide walks through deploying from local to develop environment.

## Prerequisites

1. Google Cloud SDK installed and authenticated
2. Docker installed (for backend deployment)
3. Android SDK installed (for Android app build)
4. Git configured with access to repository

## Step-by-Step Deployment

### 1. Prepare Git Repository

```bash
# Remove git lock if exists
rm -f .git/index.lock

# Stage all changes
git add -A

# Commit changes
git commit -m "Deploy to develop: Add penalties table, endpoints, and UI improvements"

# Switch to develop branch
git checkout develop || git checkout -b develop

# Merge main into develop
git merge main --no-edit

# Push to GitHub (triggers Netlify frontend deployment)
git push origin develop
```

### 2. Run Database Migrations

```bash
cd backend
node scripts/create-penalties-table-direct.js
cd ..
```

This will:
- Check if `penalties` table exists
- Create it if missing
- Also check/create `loans` table if needed

### 3. Deploy Backend to Google Cloud Run

**Option A: Using Cloud Build (Recommended)**

```bash
cd backend

# Set gcloud project
gcloud config set project dialadrink-production

# Authenticate (if needed)
gcloud auth login dialadrinkkenya254@gmail.com

# Trigger Cloud Build
gcloud builds submit --config=cloudbuild-dev.yaml .
```

**Option B: Direct Deployment (if Cloud Build fails)**

```bash
cd backend

# Build Docker image
IMAGE_NAME="gcr.io/dialadrink-production/deliveryos-backend:develop-$(date +%s)"
docker build -t $IMAGE_NAME .

# Push to Container Registry
docker push $IMAGE_NAME

# Deploy to Cloud Run
gcloud run deploy deliveryos-development-backend \
    --image $IMAGE_NAME \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --timeout 300 \
    --add-cloudsql-instances dialadrink-production:us-central1:dialadrink-db-dev \
    --update-env-vars NODE_ENV=development,FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech,HOST=0.0.0.0
```

### 4. Verify CORS Configuration

CORS is already configured in `backend/app.js` with the following allowed origins:
- `https://dialadrink.thewolfgang.tech` (Customer frontend)
- `https://dialadrink-admin.thewolfgang.tech` (Admin frontend)
- `https://*.netlify.app` (Netlify previews)
- Local development URLs

The deployment maintains CORS settings automatically.

### 5. Build Android App for DevelopDebug

```bash
cd driver-app-native

# Build developdebug variant
./gradlew assembleDevelopmentDebug

# APK will be at:
# app/build/outputs/apk/development/debug/app-development-debug.apk
```

### 6. Verify Deployment

1. **Backend Health Check:**
   ```bash
   curl https://deliveryos-development-backend-805803410802.us-central1.run.app/api/health
   ```

2. **Check Netlify Deployment:**
   - Visit Netlify dashboard
   - Check deployment status for frontend sites

3. **Test Endpoints:**
   - Test `/api/admin/penalties` endpoint
   - Test `/api/admin/drivers/:id/penalty-balance` endpoint

## Automated Deployment Script

Run the automated script:

```bash
./deploy-to-develop.sh
```

This script handles all steps automatically.

## Troubleshooting

### Git Lock File Error
```bash
rm -f .git/index.lock
```

### Cloud Build Fails
- Check gcloud authentication: `gcloud auth list`
- Verify project: `gcloud config get-value project`
- Check service account permissions

### Database Migration Fails
- Ensure DATABASE_URL is set correctly
- Check database connection
- Verify Cloud SQL instance is accessible

### CORS Issues
- Verify FRONTEND_URL and ADMIN_URL env vars are set
- Check backend logs for CORS errors
- Ensure allowed origins include your frontend URLs

## Service Details

- **Backend Service:** `deliveryos-development-backend`
- **Region:** `us-central1`
- **Project:** `dialadrink-production`
- **Database:** `dialadrink-db-dev` (Cloud SQL)
- **Frontend URLs:**
  - Customer: `https://dialadrink.thewolfgang.tech`
  - Admin: `https://dialadrink-admin.thewolfgang.tech`

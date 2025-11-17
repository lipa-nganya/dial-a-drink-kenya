# 🔄 Setup Automatic Deployments with Cloud Build

This guide will help you connect your GitHub repository to Google Cloud Build for automatic deployments.

## 📋 Prerequisites

- Google Cloud Project: `drink-suite`
- GitHub Repository: `https://github.com/lipa-nganya/dial-a-drink-kenya`
- Cloud Build API enabled
- Cloud Run API enabled

## 🚀 Step-by-Step Setup

### Step 1: Enable Required APIs

```bash
# Set your project
gcloud config set project drink-suite

# Enable Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com
```

### Step 2: Connect GitHub Repository

1. **Go to Cloud Build Triggers**
   - Visit: https://console.cloud.google.com/cloud-build/triggers
   - Project: `drink-suite`

2. **Connect Repository**
   - Click **"Connect Repository"**
   - Select **"GitHub (Cloud Build GitHub App)"**
   - Authenticate with GitHub
   - Select repository: `lipa-nganya/dial-a-drink-kenya`
   - Click **"Connect"**

### Step 3: Create Backend Trigger

1. **Click "Create Trigger"**

2. **Trigger Settings**:
   - **Name**: `deploy-backend`
   - **Event**: `Push to a branch`
   - **Branch**: `^main$` (regex)
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `backend/cloudbuild.yaml`

3. **Advanced** (Optional):
   - **Substitution variables**:
     - `_SERVICE_NAME`: `liquoros-backend`
     - `_REGION`: `us-central1`

4. **Click "Create"**

### Step 4: Create Frontend Trigger

1. **Click "Create Trigger"**

2. **Trigger Settings**:
   - **Name**: `deploy-frontend`
   - **Event**: `Push to a branch`
   - **Branch**: `^main$` (regex)
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `frontend/cloudbuild.yaml`

3. **Click "Create"**

### Step 5: Create Admin Frontend Trigger

1. **Click "Create Trigger"**

2. **Trigger Settings**:
   - **Name**: `deploy-admin`
   - **Event**: `Push to a branch`
   - **Branch**: `^main$` (regex)
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `admin-frontend/cloudbuild.yaml`

3. **Click "Create"**

## 🔐 Step 6: Grant Cloud Build Permissions

Cloud Build needs permission to deploy to Cloud Run:

```bash
# Get Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe drink-suite --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

## 🔧 Step 7: Set Environment Variables (Backend)

Backend needs environment variables. Set them in Cloud Run:

```bash
# Deploy backend with environment variables
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend:latest \
  --region us-central1 \
  --platform managed \
  --set-env-vars "NODE_ENV=production,PORT=8080,DATABASE_URL=[YOUR_DATABASE_URL],MPESA_CONSUMER_KEY=[YOUR_KEY],MPESA_CONSUMER_SECRET=[YOUR_SECRET],MPESA_SHORTCODE=[YOUR_SHORTCODE],MPESA_PASSKEY=[YOUR_PASSKEY],MPESA_ENVIRONMENT=sandbox,FORCE_REAL_MPESA=true"
```

**Or set via Console**:
1. Go to Cloud Run → `dialadrink-backend` → Edit & Deploy New Revision
2. Go to **"Variables & Secrets"** tab
3. Add environment variables
4. Deploy

## ✅ Step 8: Test Automatic Deployment

1. **Make a small change** to any file in `backend/`, `frontend/`, or `admin-frontend/`
2. **Commit and push**:
   ```bash
   git add .
   git commit -m "test: Trigger auto-deployment"
   git push origin main
   ```
3. **Check Cloud Build**:
   - Visit: https://console.cloud.google.com/cloud-build/builds
   - You should see builds starting automatically
4. **Monitor deployment**:
   - Builds will appear in the Cloud Build dashboard
   - Each service will deploy automatically when its directory changes

## 📊 Monitoring Deployments

### View Build History
- **Cloud Build Dashboard**: https://console.cloud.google.com/cloud-build/builds
- Shows all builds, their status, and logs

### View Cloud Run Services
- **Cloud Run Dashboard**: https://console.cloud.google.com/run
- Shows deployed services and their URLs

### View Logs
```bash
# Backend logs
gcloud run services logs read liquoros-backend --region us-central1

# Frontend logs
gcloud run services logs read liquoros-customer --region us-central1

# Admin logs
gcloud run services logs read liquoros-admin --region us-central1
```

## 🎯 How It Works

1. **You push to GitHub** → `main` branch
2. **Cloud Build detects** the push via trigger
3. **Cloud Build runs** the `cloudbuild.yaml` file
4. **Builds Docker image** and pushes to Container Registry
5. **Deploys to Cloud Run** automatically
6. **Service is updated** with new code

## 🔄 Deployment Behavior

- **Backend changes** (`backend/` directory) → Triggers `backend/cloudbuild.yaml`
- **Frontend changes** (`frontend/` directory) → Triggers `frontend/cloudbuild.yaml`
- **Admin changes** (`admin-frontend/` directory) → Triggers `admin-frontend/cloudbuild.yaml`
- **Other changes** → No deployment (unless you configure additional triggers)

## 🚨 Troubleshooting

### Build Fails

1. **Check build logs**:
   - Cloud Build Dashboard → Click on failed build → View logs

2. **Common issues**:
   - Missing environment variables
   - Docker build errors
   - Permission issues

### Service Not Updating

1. **Check trigger configuration**:
   - Ensure branch pattern matches (`^main$`)
   - Verify `cloudbuild.yaml` path is correct

2. **Check Cloud Build service account**:
   - Ensure it has Cloud Run Admin permissions

### Permission Errors

```bash
# Re-grant permissions
PROJECT_NUMBER=$(gcloud projects describe drink-suite --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

## 📝 Next Steps

After setup:
1. ✅ Push a test change to verify auto-deployment works
2. ✅ Monitor first deployment in Cloud Build dashboard
3. ✅ Verify services are accessible after deployment
4. ✅ Set up alerts for failed builds (optional)

## 🔗 Useful Links

- **Cloud Build Dashboard**: https://console.cloud.google.com/cloud-build
- **Cloud Run Dashboard**: https://console.cloud.google.com/run
- **Cloud Build Docs**: https://cloud.google.com/build/docs
- **Cloud Run Docs**: https://cloud.google.com/run/docs



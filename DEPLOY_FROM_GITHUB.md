# 🚀 Deploy from GitHub to Google Cloud

This guide explains how to deploy your application from GitHub to Google Cloud Run.

## 📋 Two Deployment Options

### Option 1: Manual Deployment (Works Now)

Deploy directly from your local machine using Cloud Build:

```bash
./manual-deploy-to-cloud.sh
```

This script will:
- Fetch the latest code from GitHub
- Build and deploy backend, frontend, and admin services
- Use Cloud Build to create container images and deploy to Cloud Run

**Note:** This requires your local machine to have `gcloud` CLI configured and authenticated.

---

### Option 2: Automatic Deployment via Triggers (Recommended)

Set up Cloud Build triggers so that every push to `main` branch automatically deploys:

#### Step 1: Connect GitHub Repository

1. Visit: https://console.cloud.google.com/cloud-build/triggers?project=drink-suite
2. Click **"Connect Repository"**
3. Select **"GitHub (Cloud Build GitHub App)"**
4. Authenticate with GitHub
5. Select repository: **lipa-nganya/dial-a-drink-kenya**
6. Click **"Connect"**

#### Step 2: Create Triggers

After connecting the repository, run:

```bash
./create-cloud-build-triggers.sh
```

This will create three triggers:
- **deploy-backend** - Deploys when `backend/` changes
- **deploy-frontend** - Deploys when `frontend/` changes  
- **deploy-admin** - Deploys when `admin-frontend/` changes

#### Step 3: Test Automatic Deployment

```bash
git commit --allow-empty -m "test: Trigger Cloud Build"
git push origin main
```

Monitor the build at: https://console.cloud.google.com/cloud-build/builds?project=drink-suite

---

## ⚙️ Important Configuration Notes

### Backend Environment Variables

The backend Cloud Build configuration (`backend/cloudbuild.yaml`) will:
- ✅ Connect to Cloud SQL automatically
- ✅ Set `NODE_ENV=production` and `PORT=8080`
- ⚠️ **Preserve existing environment variables** (like `DATABASE_URL`, M-Pesa credentials)

**To ensure DATABASE_URL is preserved:**
```bash
gcloud run services update dialadrink-backend \
  --region=us-central1 \
  --project=drink-suite \
  --update-env-vars DATABASE_URL="your-database-url"
```

### Frontend & Admin Environment Variables

The frontend and admin builds set `REACT_APP_API_URL` automatically. No additional configuration needed.

---

## 🔍 Troubleshooting

### "GitHub repository not connected"

If you see this error, follow **Option 2, Step 1** above to connect your repository.

### "Permission denied" errors

Ensure Cloud Build has the necessary permissions:
```bash
PROJECT_NUMBER=$(gcloud projects describe drink-suite --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

### Build fails with "DATABASE_URL not found"

Ensure DATABASE_URL is set in Cloud Run:
```bash
gcloud run services describe dialadrink-backend \
  --region=us-central1 \
  --project=drink-suite \
  --format="value(spec.template.spec.containers[0].env)"
```

---

## 📚 Related Files

- `backend/cloudbuild.yaml` - Backend build configuration
- `frontend/cloudbuild.yaml` - Frontend build configuration
- `admin-frontend/cloudbuild.yaml` - Admin build configuration
- `create-cloud-build-triggers.sh` - Script to create triggers
- `manual-deploy-to-cloud.sh` - Script for manual deployment

---

**Ready to deploy! 🚀**


# 🚀 Deploy All Services to Cloud

## ✅ Git Push Complete

All changes have been pushed to: `https://github.com/lipa-nganya/dial-a-drink-kenya`

## 📦 Services to Deploy

1. **Backend API** - Google Cloud Run
2. **Customer Site (Frontend)** - Google Cloud Run  
3. **Admin Site** - Google Cloud Run
4. **Driver App** - Expo EAS (APK builds)

## 🔧 Deployment Steps

### 1. Backend API (Google Cloud Run)

```bash
cd backend

# Set project
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and deploy
gcloud builds submit --tag gcr.io/drink-suite/dialadrink-backend .
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "DATABASE_URL=[YOUR_CLOUD_SQL_CONNECTION_STRING]" \
  --set-env-vars "MPESA_CONSUMER_KEY=[YOUR_KEY]" \
  --set-env-vars "MPESA_CONSUMER_SECRET=[YOUR_SECRET]" \
  --set-env-vars "MPESA_SHORTCODE=[YOUR_SHORTCODE]" \
  --set-env-vars "MPESA_PASSKEY=[YOUR_PASSKEY]" \
  --set-env-vars "MPESA_ENVIRONMENT=sandbox" \
  --set-env-vars "FORCE_REAL_MPESA=true"
```

**Or use Render** (if configured):
- Render will auto-deploy from GitHub on push
- Check: https://dashboard.render.com

### 2. Customer Site (Frontend)

```bash
cd frontend

# Build locally
npm install
npm run build

# Deploy to Cloud Run
gcloud run deploy dialadrink-frontend \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api"
```

**Or use Render** (Static Site):
- Render will auto-deploy from GitHub
- Check: https://dashboard.render.com

### 3. Admin Site

```bash
cd admin-frontend

# Build locally
npm install
npm run build

# Deploy to Cloud Run
gcloud run deploy dialadrink-admin \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api"
```

**Or use Render** (Static Site):
- Render will auto-deploy from GitHub
- Check: https://dashboard.render.com

### 4. Driver App (Expo EAS)

```bash
cd DDDriverExpo

# Build cloud-dev APK
eas build --platform android --profile cloud-dev

# Or build production APK
eas build --platform android --profile production
```

**Note**: Driver app builds are limited to 1 per day (see `BUILD_LIMIT.md`)

## 🔄 Auto-Deployment

If you have **Render** configured with auto-deploy:
- ✅ Backend: Auto-deploys on push to `main`
- ✅ Frontend: Auto-deploys on push to `main`
- ✅ Admin: May need manual setup

If you have **Google Cloud Build** triggers:
- ✅ Services auto-deploy on push to `main`

## 📋 Environment Variables Checklist

### Backend
- [ ] `DATABASE_URL` - Cloud SQL connection string
- [ ] `MPESA_CONSUMER_KEY` - M-Pesa credentials
- [ ] `MPESA_CONSUMER_SECRET` - M-Pesa credentials
- [ ] `MPESA_SHORTCODE` - M-Pesa shortcode
- [ ] `MPESA_PASSKEY` - M-Pesa passkey
- [ ] `MPESA_ENVIRONMENT` - `sandbox` or `production`
- [ ] `FORCE_REAL_MPESA` - `true` for real STK pushes

### Frontend & Admin
- [ ] `REACT_APP_API_URL` - Backend API URL

## 🧪 Verify Deployment

### Backend
```bash
curl https://dialadrink-backend-910510650031.us-central1.run.app/api/health
```

### Frontend
- Visit: https://drink-suite-customer-910510650031.us-central1.run.app

### Admin
- Visit: https://[admin-url]/admin

### Driver App
- Download APK from EAS build dashboard
- Install on Android device

## 🚨 Troubleshooting

### Backend not deploying?
- Check Cloud Run logs: `gcloud run services logs read dialadrink-backend`
- Verify environment variables are set
- Check DATABASE_URL is correct

### Frontend not connecting?
- Verify `REACT_APP_API_URL` points to backend
- Check CORS settings in backend
- Clear browser cache

### Driver app build failed?
- Check build limit: `./manage-build-limit.sh status`
- Verify EAS credentials: `eas whoami`
- Check build logs in Expo dashboard


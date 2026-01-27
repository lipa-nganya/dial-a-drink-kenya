# Development Deployment Setup

## Overview

The development environment deploys from the **`develop`** branch on GitHub (account: `lipanganya@gmail.com`).

## Development URLs

- **Customer Frontend**: https://dialadrink.thewolfgang.tech/
- **Admin Frontend**: https://dialadrink-admin.thewolfgang.tech/
- **Backend API**: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app
- **Database**: `dialadrink-db-dev` / `dialadrink_dev` (Cloud SQL)

## Branch Configuration

### Frontend (Customer Site)
- **Repository**: `lipanganya/dial-a-drink-kenya` (GitHub)
- **Branch**: `develop`
- **Netlify Site**: `dialadrink.thewolfgang.tech`
- **Base Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `frontend/build`

### Admin Frontend
- **Repository**: `lipanganya/dial-a-drink-kenya` (GitHub)
- **Branch**: `develop`
- **Netlify Site**: `dialadrink-admin.thewolfgang.tech`
- **Base Directory**: `admin-frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `admin-frontend/build`

### Backend
- **Repository**: `lipanganya/dial-a-drink-kenya` (GitHub)
- **Branch**: `develop`
- **Cloud Build Config**: `backend/cloudbuild.yaml`
- **Service Name**: `deliveryos-development-backend`
- **Project**: `dialadrink-production`
- **Region**: `us-central1`
- **Database**: `dialadrink-db-dev` / `dialadrink_dev`

### Android Driver App (Dev Build)
- **Repository**: `lipanganya/dial-a-drink-kenya` (GitHub)
- **Branch**: `develop`
- **Build Variant**: `devDebug` or `devRelease`
- **API Base URL**: `https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api`
- **Configuration**: `driver-app-native/gradle.properties` → `DEV_API_BASE_URL`

## API Configuration

### Frontend API URLs

Both frontend sites automatically detect the hostname and use the development backend:

```javascript
// frontend/src/services/api.js
// admin-frontend/src/services/api.js

// Development sites use:
'https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api'
```

### Backend Environment Variables

The development backend service has these environment variables:

- `NODE_ENV=development`
- `DATABASE_URL=postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev`
- `FRONTEND_URL=https://dialadrink.thewolfgang.tech`
- `ADMIN_URL=https://dialadrink-admin.thewolfgang.tech`
- `HOST=0.0.0.0`

## Cloud Build Trigger Setup

To set up automatic deployments from `develop` branch:

```bash
# Create Cloud Build trigger for develop branch
gcloud builds triggers create github \
  --name="deploy-development-backend" \
  --repo-name="dial-a-drink-kenya" \
  --repo-owner="lipanganya" \
  --branch-pattern="^develop$" \
  --build-config="backend/cloudbuild.yaml" \
  --project="dialadrink-production"
```

## Netlify Configuration

### Customer Site (dialadrink.thewolfgang.tech)

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Select site: **dialadrink.thewolfgang.tech**
3. **Site settings** → **Build & deploy** → **Continuous Deployment**
4. **Branch to deploy**: `develop`
5. **Base directory**: `frontend`
6. **Build command**: `npm install && npm run build`
7. **Publish directory**: `frontend/build`

### Admin Site (dialadrink-admin.thewolfgang.tech)

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Select site: **dialadrink-admin.thewolfgang.tech**
3. **Site settings** → **Build & deploy** → **Continuous Deployment**
4. **Branch to deploy**: `develop`
5. **Base directory**: `admin-frontend`
6. **Build command**: `npm install && npm run build`
7. **Publish directory**: `admin-frontend/build`

## Verification

### Check Frontend Deployment
1. Visit: https://dialadrink.thewolfgang.tech/
2. Open browser console (F12)
3. Look for: `API_BASE_URL: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api`
4. Look for: `API source: netlify-dev`

### Check Admin Deployment
1. Visit: https://dialadrink-admin.thewolfgang.tech/
2. Open browser console (F12)
3. Look for: `API_BASE_URL: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api`
4. Look for: `API source: netlify-dev`

### Check Backend Deployment
```bash
gcloud run services describe deliveryos-development-backend \
  --region us-central1 \
  --project dialadrink-production \
  --format="get(status.url)"
```

### Check Database Connection
```bash
# Verify backend is connected to dev database
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-development-backend" \
  --limit 10 \
  --format="value(textPayload,jsonPayload.message)" \
  --project dialadrink-production | grep -i "database"
```

## Workflow

### Development Workflow

1. **Create feature branch from develop**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**:
   ```bash
   git add .
   git commit -m "Add feature"
   ```

3. **Push to develop**:
   ```bash
   git checkout develop
   git merge feature/my-feature
   git push origin develop
   ```

4. **Automatic Deployment**:
   - Frontend: Netlify automatically deploys from `develop` branch
   - Backend: Cloud Build trigger deploys to `deliveryos-development-backend`
   - Android: Build dev variant with `DEV_API_BASE_URL`

## Database Credentials

See `DATABASE_CREDENTIALS.md` for development database credentials.

## Troubleshooting

### Frontend not using dev backend
- Check browser console for API configuration logs
- Verify Netlify is deploying from `develop` branch
- Check `frontend/src/services/api.js` or `admin-frontend/src/services/api.js`

### Backend not deploying
- Check Cloud Build triggers: `gcloud builds triggers list --project dialadrink-production`
- Verify branch pattern matches `^develop$`
- Check Cloud Build logs: `gcloud builds list --project dialadrink-production --limit 5`

### Database connection issues
- Verify `DATABASE_URL` environment variable in Cloud Run service
- Check Cloud SQL instance is running: `gcloud sql instances describe dialadrink-db-dev --project dialadrink-production`
- Verify Cloud SQL connection is configured: `gcloud run services describe deliveryos-development-backend --region us-central1 --project dialadrink-production --format="get(spec.template.spec.containers[0].env)"`

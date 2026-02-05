# Admin Frontend Deployment Guide

## Development vs Production

The admin frontend has separate deployment configurations for development and production environments.

### Development Deployment

**Backend URL**: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`  
**Project**: `drink-suite`  
**Database**: `drink-suite-db` / `dialadrink`

**Configuration File**: `admin-frontend/cloudbuild-dev.yaml`

**Deployment**:
- Triggered from `develop` branch
- Uses Cloud Build trigger with `cloudbuild-dev.yaml`
- Deploys to: `deliveryos-admin-frontend-dev` (Cloud Run)

**Netlify**:
- Site: `https://dialadrink-admin.thewolfgang.tech`
- Auto-detects development backend based on hostname
- No build-time environment variables needed (uses runtime detection)

### Production Deployment

**Backend URL**: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api`  
**Project**: `dialadrink-production`  
**Database**: `dialadrink-db-prod` / `dialadrink_prod`

**Configuration File**: `admin-frontend/cloudbuild.yaml`

**Deployment**:
- Triggered from `main` branch
- Uses Cloud Build trigger with `cloudbuild.yaml`
- Deploys to: `deliveryos-admin-frontend` (Cloud Run)

## Runtime Backend Detection

The admin frontend automatically detects which backend to use based on the hostname:

- **Local**: `localhost` → `http://localhost:5001/api`
- **Development**: `*.thewolfgang.tech` → `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
- **Production**: `ruakadrinksdelivery.co.ke` or `drinksdeliverykenya.com` → Production backend

This is handled in:
- `admin-frontend/src/services/api.js` → `resolveApiBaseUrl()`
- `admin-frontend/src/utils/backendUrl.js` → `getBackendUrl()`

## Cloud Build Triggers

### Development Trigger

```bash
gcloud builds triggers create github \
  --name="deploy-admin-frontend-dev" \
  --repo-name="dial-a-drink-kenya" \
  --repo-owner="lipanganya" \
  --branch-pattern="^develop$" \
  --build-config="admin-frontend/cloudbuild-dev.yaml" \
  --project="drink-suite"
```

### Production Trigger

```bash
gcloud builds triggers create github \
  --name="deploy-admin-frontend-prod" \
  --repo-name="dial-a-drink-kenya" \
  --repo-owner="lipanganya" \
  --branch-pattern="^main$" \
  --build-config="admin-frontend/cloudbuild.yaml" \
  --project="dialadrink-production"
```

## Manual Deployment

### Development

```bash
cd admin-frontend
gcloud builds submit --config=cloudbuild-dev.yaml --project=drink-suite
```

### Production

```bash
cd admin-frontend
gcloud builds submit --config=cloudbuild.yaml --project=dialadrink-production
```

## Verification

After deployment, verify the correct backend is being used:

1. Open browser console (F12) on the deployed site
2. Look for: `API_BASE_URL: <backend-url>`
3. Check: `API source: <source>` (should be `netlify-dev` for development)

## Important Notes

- **Netlify deployments** use runtime hostname detection, so they don't need build-time environment variables
- **Cloud Run deployments** use build-time `REACT_APP_API_URL` environment variable
- **Always verify** the backend URL in browser console after deployment
- **Development backend** is in `drink-suite` project, not `dialadrink-production`

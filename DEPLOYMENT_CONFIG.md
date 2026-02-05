# Deployment Configuration

This document defines the correct backend URLs and database configurations for development and production environments.

## Development Environment

### Backend Service
- **Service Name**: `deliveryos-backend`
- **Project**: `drink-suite`
- **URL**: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`
- **API URL**: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
- **Database**: `drink-suite-db` / `dialadrink` (in `drink-suite` project)
- **Database User**: `dialadrink_app`
- **Connection**: `drink-suite:us-central1:drink-suite-db`

### Frontend Sites (Netlify)
- **Customer Site**: `https://dialadrink.thewolfgang.tech`
- **Admin Site**: `https://dialadrink-admin.thewolfgang.tech`

### Configuration Files
- **Admin Frontend**: `admin-frontend/src/services/api.js` → `DEFAULT_DEV_API_BASE`
- **Admin Frontend**: `admin-frontend/src/utils/backendUrl.js` → Development site detection
- **Admin Frontend Cloud Build**: `admin-frontend/cloudbuild-dev.yaml`
- **Backend Cloud Build**: `backend/cloudbuild-dev.yaml`

## Production Environment

### Backend Service
- **Service Name**: `deliveryos-production-backend`
- **Project**: `dialadrink-production`
- **URL**: `https://deliveryos-production-backend-805803410802.us-central1.run.app`
- **API URL**: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api`
- **Database**: `dialadrink-db-prod` / `dialadrink_prod` (in `dialadrink-production` project)

### Frontend Sites
- **Customer Site**: `https://ruakadrinksdelivery.co.ke` or `https://drinksdeliverykenya.com`
- **Admin Site**: Production admin URL

### Configuration Files
- **Admin Frontend**: `admin-frontend/src/services/api.js` → `DEFAULT_PRODUCTION_API_BASE`
- **Admin Frontend Cloud Build**: `admin-frontend/cloudbuild.yaml`

## Important Notes

1. **Development backend is in `drink-suite` project**, not `dialadrink-production`
2. **Netlify sites** (`thewolfgang.tech`) automatically detect and use development backend
3. **Production sites** (`ruakadrinksdelivery.co.ke`, `drinksdeliverykenya.com`) automatically use production backend
4. **Local development** always uses `http://localhost:5001/api` regardless of environment variables

## Deployment

### Development (from `develop` branch)
- Backend: Use `deploy-all-to-dev.sh` or Cloud Build trigger with `backend/cloudbuild-dev.yaml`
- Admin Frontend: Cloud Build trigger with `admin-frontend/cloudbuild-dev.yaml`
- Customer Frontend: Netlify auto-deploys from `develop` branch

### Production (from `main` branch)
- Backend: Use `deploy-backend-production.sh` or Cloud Build trigger with `backend/cloudbuild.yaml`
- Admin Frontend: Cloud Build trigger with `admin-frontend/cloudbuild.yaml`
- Customer Frontend: Netlify auto-deploys from `main` branch

## Verification

To verify the correct backend is being used:

1. **Check browser console** (F12) on deployed sites:
   - Development sites should show: `API_BASE_URL: https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
   - Production sites should show: `API_BASE_URL: https://deliveryos-production-backend-805803410802.us-central1.run.app/api`

2. **Check backend health**:
   ```bash
   # Development
   curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
   
   # Production
   curl https://deliveryos-production-backend-805803410802.us-central1.run.app/api/health
   ```

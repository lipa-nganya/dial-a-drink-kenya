# Complete Development & Production Setup Guide

## Overview

This guide sets up a complete development and production environment structure:

- **Development**: `develop` branch → dev backend → dev database → dev frontends
- **Production**: `main` branch → prod backend → prod database → prod frontends

---

## Architecture

### Development Environment
- **Backend Service**: `deliveryos-backend-dev`
- **Database**: `dialadrink-db-dev`
- **Frontends**:
  - Customer: `https://dialadrink.thewolfgang.tech`
  - Admin: `https://dialadrink-admin.thewolfgang.tech`
- **Driver App**: Development build variant
- **GitHub Branch**: `develop`

### Production Environment
- **Backend Service**: `deliveryos-backend-prod`
- **Database**: `dialadrink-db-prod` (already exists)
- **Frontends**:
  - Customer: `https://ruakadrinksdelivery.co.ke`
  - Admin: `https://dial-a-drink-admin.netlify.app`
- **Driver App**: Production build variant
- **GitHub Branch**: `main`

---

## Step 1: Create Development Cloud SQL Database

```bash
gcloud config set account dialadrinkkenya254@gmail.com
gcloud config set project dialadrink-production

# Create development database instance
gcloud sql instances create dialadrink-db-dev \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --project=dialadrink-production

# Create database
gcloud sql databases create dialadrink_dev \
  --instance=dialadrink-db-dev \
  --project=dialadrink-production

# Create database user
gcloud sql users create dialadrink_app \
  --instance=dialadrink-db-dev \
  --password=DEV_DATABASE_PASSWORD \
  --project=dialadrink-production
```

**Note:** Replace `DEV_DATABASE_PASSWORD` with a secure password.

---

## Step 2: Deploy Development Backend Service

```bash
cd backend

# Build and deploy development backend
gcloud builds submit --tag gcr.io/dialadrink-production/deliveryos-backend-dev .

# Get development database connection details
DEV_CONNECTION_NAME=$(gcloud sql instances describe dialadrink-db-dev \
  --format="get(connectionName)" \
  --project=dialadrink-production)

# Deploy development backend
gcloud run deploy deliveryos-backend-dev \
  --image gcr.io/dialadrink-production/deliveryos-backend-dev:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances="${DEV_CONNECTION_NAME}" \
  --set-env-vars "NODE_ENV=development,FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech" \
  --update-env-vars "DATABASE_URL=postgresql://dialadrink_app:DEV_PASSWORD@/dialadrink_dev?host=/cloudsql/${DEV_CONNECTION_NAME}" \
  --memory 512Mi \
  --timeout 300 \
  --project dialadrink-production
```

---

## Step 3: Configure Production Backend Service

Rename existing backend to production:

```bash
# The existing service can be renamed or we create a new one
# For now, we'll create a new production service
gcloud builds submit --tag gcr.io/dialadrink-production/deliveryos-backend-prod .

# Get production database connection
PROD_CONNECTION_NAME=$(gcloud sql instances describe dialadrink-db-prod \
  --format="get(connectionName)" \
  --project=dialadrink-production)

# Deploy production backend
gcloud run deploy deliveryos-backend-prod \
  --image gcr.io/dialadrink-production/deliveryos-backend-prod:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances="${PROD_CONNECTION_NAME}" \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=https://ruakadrinksdelivery.co.ke,ADMIN_URL=https://dial-a-drink-admin.netlify.app" \
  --update-env-vars "DATABASE_URL=postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/${PROD_CONNECTION_NAME}" \
  --memory 512Mi \
  --timeout 300 \
  --project dialadrink-production
```

---

## Step 4: Update Frontend API Configuration

### Customer Frontend (`frontend/src/services/api.js`)

Update to detect development vs production sites:

```javascript
// Development sites (Netlify - betastart9@gmail.com)
const isDevSite = hostname.includes('dialadrink.thewolfgang.tech');
if (isDevSite) {
  return { url: 'https://deliveryos-backend-dev-XXXXX.us-central1.run.app/api', source: 'netlify-dev' };
}

// Production sites
const isProductionSite = hostname.includes('ruakadrinksdelivery.co.ke');
if (isProductionSite) {
  return { url: 'https://deliveryos-backend-prod-XXXXX.us-central1.run.app/api', source: 'production-site' };
}
```

### Admin Frontend (`admin-frontend/src/services/api.js`)

Same logic for admin frontend.

---

## Step 5: Update Driver App Configuration

### `driver-app-native/gradle.properties`

```properties
# Development API (development backend)
DEV_API_BASE_URL=https://deliveryos-backend-dev-XXXXX.us-central1.run.app/api

# Production API (production backend)
PROD_API_BASE_URL=https://deliveryos-backend-prod-XXXXX.us-central1.run.app/api
```

---

## Step 6: Update Backend CORS Configuration

Both backend services need CORS for their respective frontends:

### Development Backend CORS
- `https://dialadrink.thewolfgang.tech`
- `https://dialadrink-admin.thewolfgang.tech`

### Production Backend CORS
- `https://ruakadrinksdelivery.co.ke`
- `https://dial-a-drink-admin.netlify.app`

---

## Step 7: GitHub Branch Configuration

### Develop Branch → Development
- Deploys to: Development backend
- Uses: Development database
- Frontends: dialadrink.thewolfgang.tech, dialadrink-admin.thewolfgang.tech
- Driver App: Development build variant

### Main Branch → Production
- Deploys to: Production backend
- Uses: Production database
- Frontends: ruakadrinksdelivery.co.ke, dial-a-drink-admin.netlify.app
- Driver App: Production build variant

---

## Step 8: Netlify Configuration

### Development Sites (betastart9@gmail.com)
- **dialadrink.thewolfgang.tech**: Deploy from `develop` branch
- **dialadrink-admin.thewolfgang.tech**: Deploy from `develop` branch

### Production Sites
- **ruakadrinksdelivery.co.ke**: Deploy from `main` branch
- **dial-a-drink-admin.netlify.app**: Deploy from `main` branch

---

## Migration Steps

1. **Create development database**
2. **Deploy development backend**
3. **Migrate inventory to development database** (for testing)
4. **Deploy production backend** (rename existing or create new)
5. **Migrate inventory to production database**
6. **Update frontend configurations**
7. **Update driver app configurations**
8. **Update backend CORS**
9. **Configure Netlify branches**
10. **Test all connections**

---

## Service URLs Reference

After setup, you'll have:

### Development
- Backend: `https://deliveryos-backend-dev-XXXXX.us-central1.run.app`
- Database: `dialadrink-db-dev` / `dialadrink_dev`

### Production
- Backend: `https://deliveryos-backend-prod-XXXXX.us-central1.run.app`
- Database: `dialadrink-db-prod` / `dialadrink_prod`

---

## Next Steps

1. Run the setup scripts (to be created)
2. Migrate inventory to both databases
3. Configure Netlify branch deployments
4. Update all API configurations
5. Test all environments

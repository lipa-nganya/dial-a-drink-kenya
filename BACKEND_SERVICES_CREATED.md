# Backend Services Created

## Services Overview

### Development Backend
- **Name**: `deliveryos-development-backend`
- **URL**: (Check with `gcloud run services list`)
- **Database**: `dialadrink-db-dev` / `dialadrink_dev`
- **Environment**: Development
- **Frontends**:
  - `https://dialadrink.thewolfgang.tech`
  - `https://dialadrink-admin.thewolfgang.tech`

### Production Backend
- **Name**: `deliveryos-production-backend`
- **URL**: (Check with `gcloud run services list`)
- **Database**: `dialadrink-db-prod` / `dialadrink_prod`
- **Environment**: Production
- **Frontends**:
  - `https://ruakadrinksdelivery.co.ke`
  - `https://dial-a-drink-admin.netlify.app`

## Configuration Details

### Development Service
- **Image**: `gcr.io/dialadrink-production/deliveryos-backend:latest`
- **NODE_ENV**: `development`
- **Database Connection**: `dialadrink-production:us-central1:dialadrink-db-dev`
- **Database**: `dialadrink_dev`
- **User**: `dialadrink_app`

### Production Service
- **Image**: `gcr.io/dialadrink-production/deliveryos-backend:latest`
- **NODE_ENV**: `production`
- **Database Connection**: `dialadrink-production:us-central1:dialadrink-db-prod`
- **Database**: `dialadrink_prod`
- **User**: `dialadrink_app`

## Next Steps

1. **Update Frontend Configurations** to use new service URLs
2. **Update Driver App** `gradle.properties` with new URLs
3. **Update Backend CORS** to allow new frontend domains
4. **Run Database Migrations** on both databases
5. **Migrate Inventory** to both databases

## Commands

### Get Service URLs
```bash
gcloud run services list --region us-central1 --format="table(metadata.name,status.url)" --project dialadrink-production
```

### Test Health Endpoints
```bash
# Development
curl https://DELIVERYOS-DEVELOPMENT-BACKEND-URL/api/health

# Production
curl https://DELIVERYOS-PRODUCTION-BACKEND-URL/api/health
```

### View Logs
```bash
# Development
gcloud run services logs read deliveryos-development-backend --region us-central1 --project dialadrink-production

# Production
gcloud run services logs read deliveryos-production-backend --region us-central1 --project dialadrink-production
```

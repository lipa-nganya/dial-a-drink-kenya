# Development & Production Setup Summary

## ✅ Completed

### 1. Development Database Created
- **Instance**: `dialadrink-db-dev`
- **Database**: `dialadrink_dev`
- **User**: `dialadrink_app`
- **Password**: `o61yqm5fLiTwWnk5` (saved in `DEV_DATABASE_CREDENTIALS.txt`)
- **Connection**: `dialadrink-production:us-central1:dialadrink-db-dev`

### 2. Production Database (Already Exists)
- **Instance**: `dialadrink-db-prod`
- **Database**: `dialadrink_prod`
- **User**: `dialadrink_app`
- **Password**: `E7A3IIa60hFD3bkGH1XAiryvB`
- **Connection**: `dialadrink-production:us-central1:dialadrink-db-prod`

## 📋 Next Steps

### Step 1: Deploy Backend Services

Run the setup script:
```bash
./setup-dev-prod-backends.sh
```

This will:
- Build Docker image
- Deploy `deliveryos-backend-dev` (development)
- Deploy `deliveryos-backend-prod` (production)

**Note**: You may need to copy environment variables (M-Pesa credentials, etc.) from existing services.

### Step 2: Get Backend URLs

After deployment, get the service URLs:
```bash
gcloud run services list --region us-central1 --format="table(metadata.name,status.url)"
```

### Step 3: Update Frontend API Configurations

#### Customer Frontend (`frontend/src/services/api.js`)

```javascript
// Development sites
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

#### Admin Frontend (`admin-frontend/src/services/api.js`)

Same logic:
- `dialadrink-admin.thewolfgang.tech` → development backend
- `dial-a-drink-admin.netlify.app` → production backend

### Step 4: Update Driver App

#### `driver-app-native/gradle.properties`

```properties
# Development API
DEV_API_BASE_URL=https://deliveryos-backend-dev-XXXXX.us-central1.run.app/api

# Production API
PROD_API_BASE_URL=https://deliveryos-backend-prod-XXXXX.us-central1.run.app/api
```

### Step 5: Update Backend CORS

Both backend services need CORS for their frontends:

**Development Backend** (`deliveryos-backend-dev`):
- `https://dialadrink.thewolfgang.tech`
- `https://dialadrink-admin.thewolfgang.tech`

**Production Backend** (`deliveryos-backend-prod`):
- `https://ruakadrinksdelivery.co.ke`
- `https://dial-a-drink-admin.netlify.app`

### Step 6: Run Database Migrations

Initialize both databases:
```bash
# Development database
DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev" \
npm run migrate

# Production database
DATABASE_URL="postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod" \
npm run migrate
```

### Step 7: Migrate Inventory

Run inventory migration for both databases:
- Development: From old database to `dialadrink_dev`
- Production: From old database to `dialadrink_prod`

### Step 8: Configure Netlify

**Development Sites** (betastart9@gmail.com):
- `dialadrink.thewolfgang.tech` → Deploy from `develop` branch
- `dialadrink-admin.thewolfgang.tech` → Deploy from `develop` branch

**Production Sites**:
- `ruakadrinksdelivery.co.ke` → Deploy from `main` branch
- `dial-a-drink-admin.netlify.app` → Deploy from `main` branch

## 🔗 Service URLs (After Deployment)

### Development
- Backend: `https://deliveryos-backend-dev-XXXXX.us-central1.run.app`
- Database: `dialadrink-db-dev` / `dialadrink_dev`

### Production
- Backend: `https://deliveryos-backend-prod-XXXXX.us-central1.run.app`
- Database: `dialadrink-db-prod` / `dialadrink_prod`

## 📝 Important Notes

1. **Environment Variables**: Copy M-Pesa credentials, PesaPal credentials, and other API keys from existing services
2. **Database Migrations**: Run migrations on both databases
3. **Inventory Migration**: Migrate inventory data to both databases
4. **CORS Configuration**: Update backend CORS for all frontend sites
5. **Socket.IO**: Update Socket.IO CORS in `backend/server.js`

## 🚀 Quick Start

1. Run `./setup-dev-prod-backends.sh`
2. Get backend URLs
3. Update frontend configurations
4. Update driver app configuration
5. Update backend CORS
6. Run migrations
7. Migrate inventory
8. Configure Netlify branches

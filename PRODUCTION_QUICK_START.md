# 🚀 Production Setup Quick Start

Quick reference for setting up Dial A Drink production environment.

## Prerequisites Checklist

- [ ] Google Cloud account: `dialadrinkkenya254@gmail.com`
- [ ] GitHub account (same as dev)
- [ ] Git branches set up (`main` for production, `develop` for dev)
- [ ] Netlify account (separate from dev)
- [ ] Android Studio installed
- [ ] gcloud CLI installed and authenticated

## Quick Setup Steps

### 0. Set Up Git Branches (If Not Done)

```bash
./setup-production-branches.sh
```

This sets up:
- `develop` branch → Development
  - Customer: https://dialadrink.thewolfgang.tech/
  - Admin: https://dialadrink-admin.thewolfgang.tech/
  - Backend: GCP project `910510650031`
  - Android: Development build
- `main` branch → Production
  - Customer: (Production Netlify URL)
  - Admin: (Production Netlify URL)
  - Backend: GCP project `dialadrink-production`
  - Android: Production build

See `SETUP_GIT_BRANCHES.md` for details.
See `DEVELOPMENT_BRANCH_SETUP.md` to verify development is linked to `develop` branch.

### 1. Authenticate with GCP

```bash
gcloud auth login dialadrinkkenya254@gmail.com
```

### 2. Run Production Setup

```bash
./setup-production.sh
```

**Important**: 
- Save the database password when shown
- Link billing account when prompted
- Configuration saved to `production-config.env`

### 3. Run Migrations

```bash
./backend/scripts/run-production-migrations.sh
```

### 4. Deploy Backend

```bash
./deploy-backend-production.sh
```

### 5. Configure Production Secrets

After deployment, update with production credentials:

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --format "value(status.url)")

# Update secrets
gcloud run services update dialadrink-backend-prod \
    --region us-central1 \
    --project dialadrink-production \
    --update-env-vars "PESAPAL_CONSUMER_KEY=<PROD_KEY>" \
    --update-env-vars "PESAPAL_CONSUMER_SECRET=<PROD_SECRET>" \
    --update-env-vars "PESAPAL_ENVIRONMENT=live" \
    --update-env-vars "FRONTEND_URL=<CUSTOMER_URL>" \
    --update-env-vars "ADMIN_URL=<ADMIN_URL>"
```

### 6. Set Up Netlify

**Production Netlify Account:**
- Email: `dialadrinkkenya254@gmail.com`
- Password: `Malibu2026.`

**Quick Setup:**
```bash
./setup-netlify-production.sh
```

**Or Manual Setup:**

**Important**: Production Netlify sites should deploy from `main` branch.

1. **Login to Netlify:**
   - Go to https://app.netlify.com
   - Email: `dialadrinkkenya254@gmail.com`
   - Password: `Malibu2026.`

2. **Customer Frontend:**
   - Repository: Same GitHub repo
   - **Branch: `main`** (production)
   - Base directory: `frontend`
   - Build: `npm install && npm run build`
   - Publish: `frontend/build`
   - Env: `REACT_APP_API_URL=https://<BACKEND_URL>/api`

3. **Admin Frontend:**
   - Repository: Same GitHub repo
   - **Branch: `main`** (production)
   - Base directory: `admin-frontend`
   - Build: `npm install && npm run build`
   - Publish: `admin-frontend/build`
   - Env: `REACT_APP_API_URL=https://<BACKEND_URL>/api`

**Note**: Development Netlify sites should use `develop` branch.

### 7. Build Android App

```bash
./build-android-production.sh
```

Output:
- APK: `driver-app-native/app/build/outputs/apk/production/release/app-production-release.apk`
- AAB: `driver-app-native/app/build/outputs/bundle/productionRelease/app-production-release.aab`

## Configuration Files

- `production-config.env` - Production configuration (DO NOT COMMIT)
- `PRODUCTION_SETUP_GUIDE.md` - Detailed setup guide
- `setup-production.sh` - GCP setup script
- `deploy-backend-production.sh` - Backend deployment script
- `build-android-production.sh` - Android build script

## Important URLs

After setup, save these URLs:

- **Backend API**: `https://<SERVICE_URL>/api`
- **Customer Frontend**: `https://<CUSTOMER_NETLIFY_URL>`
- **Admin Frontend**: `https://<ADMIN_NETLIFY_URL>`

## Troubleshooting

**Can't connect to database?**
- Check Cloud SQL instance is running
- Verify connection name in `production-config.env`
- Check service account permissions

**Frontend build fails?**
- Check Netlify build logs
- Verify environment variables are set
- Check API URL is correct

**Android build fails?**
- Open project in Android Studio
- Sync Gradle files
- Check `gradle.properties` for API URL

## Next Steps

1. Test all services
2. Configure custom domains
3. Set up monitoring
4. Configure backups
5. Upload AAB to Play Store

For detailed instructions, see `PRODUCTION_SETUP_GUIDE.md`.

# Production Deployment - Ready to Deploy

## ✅ Changes Committed

All security improvements and configuration updates have been committed to the repository.

## 📋 Pre-Deployment Checklist

### 1. Set Environment Variables

Before running the deployment script, set these environment variables:

```bash
export GOOGLE_MAPS_API_KEY="AIzaSyBYs413EeQVcChjlgrOMFd7U2dy60xiirk"
export MPESA_CONSUMER_KEY="hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr"
export MPESA_CONSUMER_SECRET="IYFIJvfjSsHHqTyU"
export MPESA_SHORTCODE="7861733"
export MPESA_PASSKEY="bfb205c2a0b53eb1685038322a8d6ae95abc2d63245eba38e96cc5fe45c84065"
export PESAPAL_CONSUMER_KEY="InqWcWvl2RKMObEqVcbZrlCVsWi5HBBu"
export PESAPAL_CONSUMER_SECRET="DORzlWHU4xXKpkM6xnbZBlc3bV4="
```

### 2. Verify Google Cloud Account

```bash
gcloud auth list
```

Should show: `dialadrinkkenya254@gmail.com`

If not, switch accounts:
```bash
gcloud auth login dialadrinkkenya254@gmail.com
gcloud config set account dialadrinkkenya254@gmail.com
```

### 3. Verify Project

```bash
gcloud config get-value project
```

Should show: `dialadrink-production`

If not:
```bash
gcloud config set project dialadrink-production
```

## 🚀 Deployment Steps

### Step 1: Switch to Main Branch (if needed)

```bash
git checkout main
git merge develop --no-edit
```

### Step 2: Run Deployment Script

```bash
./deploy-to-production-complete.sh
```

The script will:
1. ✅ Run database migration for stop fields
2. ✅ Deploy backend to Cloud Run with all credentials
3. ✅ Deploy customer frontend to Cloud Run
4. ✅ Deploy admin frontend to Cloud Run
5. ✅ Build Android productionDebug variant (if Gradle is available)

## 📝 What Will Be Deployed

### Backend
- Security improvements (environment variable-based credentials)
- Google Maps API key configuration
- Updated M-Pesa and PesaPal callback URL handling
- Stop fields migration support

### Frontends
- Google Maps API key via Cloud Build substitution variables
- Security improvements (no hardcoded keys in Dockerfiles)

### Database
- Stop fields migration (`isStop`, `stopDeductionAmount` columns)

## ⚠️ Important Notes

1. **Cloud Build Substitution Variables**: The frontend deployments require `_GOOGLE_MAPS_API_KEY` to be set in Cloud Build triggers. If not set, the build will fail.

2. **Database Migration**: The script will attempt to run the stop fields migration. If it fails, you can run it manually via Cloud SQL Console.

3. **Credentials**: The deployment script will use environment variables if set, otherwise it will use fallback values with warnings.

## 🔍 Post-Deployment Verification

After deployment, verify:

1. **Backend Health**:
   ```bash
   curl https://deliveryos-production-backend-805803410802.us-central1.run.app/api/health
   ```

2. **Frontend URLs**:
   - Customer: https://ruakadrinksdelivery.co.ke
   - Admin: https://admin.ruakadrinksdelivery.co.ke

3. **Payment Services**:
   - Test M-Pesa payment initiation
   - Test PesaPal payment initiation

4. **Google Maps**:
   - Test address autocomplete on customer site
   - Test route optimization on admin panel

## 📞 Support

If deployment fails:
1. Check Cloud Run logs
2. Check Cloud Build logs
3. Verify environment variables are set
4. Verify gcloud account and project

# Backend Service Migration Summary

## ✅ Migration Complete

The backend service has been successfully redeployed to the `dialadrinkkenya254@gmail.com` account.

---

## 🆕 New Service Details

**Account:** `dialadrinkkenya254@gmail.com`  
**Project:** `dialadrink-production`  
**Service Name:** `deliveryos-backend`  
**Region:** `us-central1`  
**URL:** `https://deliveryos-backend-805803410802.us-central1.run.app`  
**API Base URL:** `https://deliveryos-backend-805803410802.us-central1.run.app/api`  
**Status:** ✅ Running and accessible

**Health Check:**
```bash
curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health
```

---

## 🔒 Old Service Status

**Account:** `lipanganya@gmail.com`  
**Project:** `drink-suite`  
**Service Name:** `deliveryos-backend`  
**URL:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`  
**Status:** ⚠️ Billing disabled - service cannot be updated/deleted via CLI

**Note:** The old service in `drink-suite` project has billing disabled, so it cannot be modified via CLI. The service will naturally become inaccessible if:
- Billing remains disabled
- Account access is revoked
- Service is manually deleted via GCP Console

---

## 📝 Required Updates

### 1. Frontend Configuration

**File:** `frontend/src/services/api.js`

Update the API base URL:
```javascript
// Change from:
const DEV_API_BASE_URL = 'https://deliveryos-backend-910510650031.us-central1.run.app';

// To:
const DEV_API_BASE_URL = 'https://deliveryos-backend-805803410802.us-central1.run.app';
```

### 2. Admin Frontend Configuration

**File:** `admin-frontend/src/services/api.js`

Update the API base URL:
```javascript
// Change from:
const DEV_API_BASE_URL = 'https://deliveryos-backend-910510650031.us-central1.run.app';

// To:
const DEV_API_BASE_URL = 'https://deliveryos-backend-805803410802.us-central1.run.app';
```

### 3. Driver App Configuration

**File:** `driver-app-native/gradle.properties`

Update the API base URL:
```properties
# Change from:
DEV_API_BASE_URL=https://deliveryos-backend-910510650031.us-central1.run.app

# To:
DEV_API_BASE_URL=https://deliveryos-backend-805803410802.us-central1.run.app
```

### 4. M-Pesa Callback URL

**Location:** M-Pesa Dashboard / Safaricom Developer Portal

Update the callback URL for STK Push:
```
Old: https://deliveryos-backend-910510650031.us-central1.run.app/api/mpesa/callback
New: https://deliveryos-backend-805803410802.us-central1.run.app/api/mpesa/callback
```

**Backend File:** `backend/services/mpesa.js`

Update the callback URL logic if it references the old URL:
```javascript
// Update getCallbackUrl() function to use new URL
callbackUrl = 'https://deliveryos-backend-805803410802.us-central1.run.app/api/mpesa/callback';
```

### 5. Backend CORS Configuration

**File:** `backend/server.js`

Ensure the new URL is in the CORS allowed origins (if needed):
```javascript
const socketAllowedOrigins = [
  'https://dialadrink.thewolfgang.tech',
  'https://dialadrink-admin.thewolfgang.tech',
  'https://deliveryos-backend-805803410802.us-central1.run.app', // Add this
  // ... other origins
];
```

### 6. Environment Variables

The new service has been deployed with:
- `NODE_ENV=production`
- `FRONTEND_URL=https://dialadrink.thewolfgang.tech`
- `ADMIN_URL=https://dialadrink-admin.thewolfgang.tech`

**Additional environment variables needed:**
- Database connection (DATABASE_URL)
- M-Pesa credentials (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, etc.)
- JWT secrets
- Other API keys

**To update environment variables:**
```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project dialadrink-production \
  --update-env-vars "KEY=value,KEY2=value2"
```

Or use Secret Manager for sensitive values:
```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project dialadrink-production \
  --update-secrets "DATABASE_URL=dialadrink-db-secret:latest"
```

---

## 🗑️ Delete Old Service (Optional)

To completely remove the old service from `lipanganya@gmail.com` account:

1. **Via GCP Console:**
   - Go to: https://console.cloud.google.com/run?project=drink-suite
   - Select the `deliveryos-backend` service
   - Click "Delete"

2. **Via CLI (if billing is enabled):**
   ```bash
   gcloud config set account lipanganya@gmail.com
   gcloud config set project drink-suite
   gcloud run services delete deliveryos-backend \
     --region us-central1 \
     --project drink-suite
   ```

---

## ✅ Verification Checklist

- [ ] Frontend updated and deployed
- [ ] Admin frontend updated and deployed
- [ ] Driver app rebuilt with new API URL
- [ ] M-Pesa callback URL updated
- [ ] Backend environment variables configured
- [ ] Database connection verified
- [ ] CORS configuration updated
- [ ] All services tested and working
- [ ] Old service disabled/deleted (optional)

---

## 🔧 Deployment Commands Reference

**Deploy backend (new account):**
```bash
gcloud config set account dialadrinkkenya254@gmail.com
gcloud config set project dialadrink-production
gcloud config set run/region us-central1

cd backend
gcloud builds submit --tag gcr.io/dialadrink-production/deliveryos-backend .
gcloud run deploy deliveryos-backend \
  --image gcr.io/dialadrink-production/deliveryos-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech"
```

**Get service URL:**
```bash
gcloud run services describe deliveryos-backend \
  --region us-central1 \
  --project dialadrink-production \
  --format="value(status.url)"
```

---

## 📞 Support

If you encounter any issues:
1. Check service logs: `gcloud run services logs read deliveryos-backend --region us-central1 --project dialadrink-production`
2. Verify health endpoint: `curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health`
3. Check IAM permissions for the service account

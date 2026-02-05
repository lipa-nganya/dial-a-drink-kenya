# Client Applications URL Update Summary

## ✅ All Client Applications Updated

All client applications have been updated to use the new backend URL deployed in the `dialadrinkkenya254@gmail.com` account.

---

## 🔄 New Backend URL

**URL:** `https://deliveryos-backend-805803410802.us-central1.run.app`  
**API Base:** `https://deliveryos-backend-805803410802.us-central1.run.app/api`  
**Project:** `dialadrink-production`  
**Account:** `dialadrinkkenya254@gmail.com`

---

## 📝 Files Updated

### 1. Frontend (Customer Site)
- ✅ `frontend/src/services/api.js`
  - Updated `DEFAULT_PRODUCTION_API_BASE`
  - Updated production Netlify fallback URL
- ✅ `frontend/src/utils/backendUrl.js`
  - Updated production backend URL
- ✅ `frontend/cloudbuild.yaml`
  - Updated `REACT_APP_API_URL` environment variable

### 2. Admin Frontend
- ✅ `admin-frontend/src/services/api.js`
  - Updated `DEFAULT_PRODUCTION_API_BASE`
  - Updated production Netlify fallback URL
- ✅ `admin-frontend/src/utils/backendUrl.js`
  - Updated production backend URL
- ✅ `admin-frontend/cloudbuild.yaml`
  - Updated `REACT_APP_API_URL` environment variable

### 3. Driver App (Android)
- ✅ `driver-app-native/gradle.properties`
  - Updated `DEV_API_BASE_URL` to new backend URL
- ✅ `driver-app-native/app/build.gradle`
  - Updated fallback URLs in `getLocalApiBaseUrl()`, `getDevApiBaseUrl()`, and `getProdApiBaseUrl()`

### 4. Backend Configuration
- ✅ `backend/server.js`
  - Added new backend URL to Socket.IO CORS allowed origins
- ✅ `backend/app.js`
  - Added new backend URL to CORS allowed origins
- ✅ `backend/services/mpesa.js`
  - Updated M-Pesa callback URL for `dialadrink-production` project
- ✅ `backend/services/pesapal.js`
  - Updated PesaPal IPN callback URL

---

## 🚀 Next Steps

### 1. Deploy Frontend Applications
After pushing to the `develop` branch, Netlify will automatically deploy:
- **Customer Frontend:** `https://dialadrink.thewolfgang.tech`
- **Admin Frontend:** `https://dialadrink-admin.thewolfgang.tech`

Both will now use the new backend URL.

### 2. Rebuild Driver App
The driver app needs to be rebuilt to use the new API URL:

```bash
cd driver-app-native
./gradlew assembleDevelopmentDebug
adb install app/build/outputs/apk/development/debug/app-development-debug.apk
```

### 3. Update M-Pesa Dashboard
Update the M-Pesa callback URL in the Safaricom Developer Portal:
- **Old:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/mpesa/callback`
- **New:** `https://deliveryos-backend-805803410802.us-central1.run.app/api/mpesa/callback`

### 4. Configure Backend Environment Variables
Ensure the new backend service has all required environment variables:
- Database connection (DATABASE_URL)
- M-Pesa credentials (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, etc.)
- JWT secrets
- Other API keys

**To update environment variables:**
```bash
gcloud config set account dialadrinkkenya254@gmail.com
gcloud config set project dialadrink-production
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --update-env-vars "KEY=value,KEY2=value2"
```

### 5. Test All Applications
- ✅ Test customer frontend: Place an order, verify API calls
- ✅ Test admin frontend: Login, verify API calls
- ✅ Test driver app: Login, fetch orders, verify API calls
- ✅ Test M-Pesa: Initiate STK push, verify callback received

---

## ✅ Verification Checklist

- [x] Frontend API configuration updated
- [x] Admin frontend API configuration updated
- [x] Driver app gradle.properties updated
- [x] Driver app build.gradle updated
- [x] Backend CORS configuration updated
- [x] M-Pesa callback URL updated
- [x] PesaPal IPN URL updated
- [x] Cloud Build configurations updated
- [x] Utility files updated
- [x] Changes committed and pushed to `develop` branch
- [ ] Frontend deployed to Netlify (automatic)
- [ ] Admin frontend deployed to Netlify (automatic)
- [ ] Driver app rebuilt and installed
- [ ] M-Pesa dashboard updated
- [ ] Backend environment variables configured
- [ ] All applications tested

---

## 📊 Old vs New URLs

| Component | Old URL | New URL |
|-----------|---------|---------|
| **Backend API** | `https://deliveryos-backend-910510650031.us-central1.run.app/api`<br>`https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api` | `https://deliveryos-backend-805803410802.us-central1.run.app/api` |
| **M-Pesa Callback** | `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/mpesa/callback` | `https://deliveryos-backend-805803410802.us-central1.run.app/api/mpesa/callback` |
| **PesaPal IPN** | `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn` | `https://deliveryos-backend-805803410802.us-central1.run.app/api/pesapal/ipn` |

---

## 🔍 Testing Commands

**Test Backend Health:**
```bash
curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health
```

**Test Frontend API Connection:**
1. Open browser console on `https://dialadrink.thewolfgang.tech`
2. Check console logs for: `API_BASE_URL: https://deliveryos-backend-805803410802.us-central1.run.app/api`

**Test Admin Frontend API Connection:**
1. Open browser console on `https://dialadrink-admin.thewolfgang.tech`
2. Check console logs for: `API_BASE_URL: https://deliveryos-backend-805803410802.us-central1.run.app/api`

**Test Driver App:**
1. Check Logcat for API base URL initialization
2. Verify API calls succeed

---

## 📝 Notes

- Old URLs are kept in CORS configuration for backward compatibility
- The dev backend URL (`910510650031`) is still referenced in M-Pesa service for the old dev project
- All production/default URLs now point to the new backend
- Frontend and admin frontend will automatically use the new URL based on hostname detection

---

## 🎯 Status

**✅ All client applications have been updated and changes committed to `develop` branch.**

The applications will automatically use the new backend URL once:
1. Netlify redeploys (automatic on push to `develop`)
2. Driver app is rebuilt with new gradle.properties
3. Backend environment variables are configured

# Backend URL Configuration - All Platforms

## ✅ Current Configuration (Verified)

**Correct Backend URL:**
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

**API Base URL:**
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

---

## 📱 Platform Configurations

### 1. **Admin Frontend** ✅
**Location:** `admin-frontend/src/services/api.js`

```javascript
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_PRODUCTION_API_BASE || 
  'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api';
```

**Location:** `admin-frontend/src/utils/backendUrl.js`

```javascript
return 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
```

**Status:** ✅ Correct - Deployed to Netlify
**URL:** https://dialadrink-admin.thewolfgang.tech

---

### 2. **Customer Frontend** ✅
**Location:** `frontend/src/services/api.js`

```javascript
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_PRODUCTION_API_BASE || 
  'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api';
```

**Location:** `frontend/src/utils/backendUrl.js`

```javascript
return 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
```

**Status:** ✅ Correct - Deployed to Netlify
**URL:** https://dialadrink.thewolfgang.tech

---

### 3. **Android Driver App** ✅
**Location:** `driver-app-native/gradle.properties`

```properties
# Development API (GCP backend)
DEV_API_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app

# Production API (GCP backend)
PROD_API_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

**Location:** `driver-app-native/app/build.gradle`

```gradle
def getDevApiBaseUrl() {
    def apiUrl = project.findProperty('DEV_API_BASE_URL') 
        ?: project.findProperty('API_BASE_URL') 
        ?: 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app'
    return apiUrl
}

def getProdApiBaseUrl() {
    def apiUrl = project.findProperty('PROD_API_BASE_URL') 
        ?: project.findProperty('API_BASE_URL') 
        ?: 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app'
    return apiUrl
}
```

**Usage in Kotlin:**
```kotlin
// ApiClient.kt
private val baseUrl = BuildConfig.API_BASE_URL

// SocketService.kt
val baseUrl = BuildConfig.API_BASE_URL
```

**Status:** ✅ Correct - Configured in gradle.properties

---

## 🔍 How Backend URL is Resolved

### Admin & Customer Frontends

Both frontends use the same resolution logic in `src/services/api.js`:

1. **Local Development:**
   - Hostname: `localhost`, `127.0.0.1`, or `.local`
   - Uses: `http://localhost:5001/api`

2. **Netlify Production:**
   - Hostname: `thewolfgang.tech` or `netlify.app`
   - Uses: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

3. **Cloud Run Dev:**
   - Hostname: `run.app`
   - Uses: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

4. **Fallback:**
   - Uses `REACT_APP_PRODUCTION_API_BASE` env var if set
   - Otherwise: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

### Android Driver App

The app uses build flavors to determine the API URL:

- **Local Debug:** Uses `LOCAL_API_BASE_URL` (ngrok by default)
- **Development Debug:** Uses `DEV_API_BASE_URL` (GCP backend)
- **Production Debug:** Uses `PROD_API_BASE_URL` (GCP backend)

The URL is injected at build time via `BuildConfig.API_BASE_URL`.

---

## 🚀 Deployment Status

### Last Deployments

**Admin Frontend:**
- ✅ Deployed: Latest (Netlify)
- ✅ Backend URL: Correct
- ✅ URL: https://dialadrink-admin.thewolfgang.tech

**Customer Frontend:**
- ✅ Deployed: Latest (Netlify)
- ✅ Backend URL: Correct
- ✅ URL: https://dialadrink.thewolfgang.tech

**Backend:**
- ✅ Deployed: Latest (Cloud Run)
- ✅ URL: https://deliveryos-backend-p6bkgryxqa-uc.a.run.app

---

## ⚠️ Common Issues

### Issue: "Error loading" on admin pages

**Cause:** Frontend build using old cached backend URL

**Fix:**
```bash
# Rebuild and redeploy
cd admin-frontend
npm run build
netlify deploy --prod --dir=build
```

### Issue: API requests failing

**Check:**
1. Browser console for API URL being used
2. Network tab for actual request URL
3. Verify `DEFAULT_PRODUCTION_API_BASE` in `src/services/api.js`

### Issue: Android app connecting to wrong backend

**Check:**
1. `gradle.properties` for `DEV_API_BASE_URL` or `PROD_API_BASE_URL`
2. Build flavor being used (local/dev/prod)
3. `BuildConfig.API_BASE_URL` value in runtime

---

## 📝 Updating Backend URL

### Admin/Customer Frontends

1. Edit `src/services/api.js`:
   ```javascript
   const DEFAULT_PRODUCTION_API_BASE = 'https://new-backend-url.com/api';
   ```

2. Edit `src/utils/backendUrl.js`:
   ```javascript
   return 'https://new-backend-url.com';
   ```

3. Rebuild and redeploy:
   ```bash
   npm run build
   netlify deploy --prod --dir=build
   ```

### Android Driver App

1. Edit `gradle.properties`:
   ```properties
   DEV_API_BASE_URL=https://new-backend-url.com
   PROD_API_BASE_URL=https://new-backend-url.com
   ```

2. Rebuild app (URL is injected at build time)

---

## ✅ Verification Checklist

After any backend URL changes:

- [ ] Admin frontend rebuilt and redeployed
- [ ] Customer frontend rebuilt and redeployed
- [ ] Android app `gradle.properties` updated
- [ ] Test admin login works
- [ ] Test customer site loads
- [ ] Test driver app connects to backend

---

**Last Updated:** January 2025  
**Backend URL:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`  
**Status:** ✅ All platforms configured correctly

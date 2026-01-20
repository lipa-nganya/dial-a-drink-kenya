# Deployment Guide - Cloud (Dev) Environment

## 🎯 Backend Service Configuration

### **Primary Backend Service (Cloud/Dev)**
When deploying to Google Cloud Run (dev environment), always deploy to:

**Service Name:** `deliveryos-backend`  
**Project:** `drink-suite`  
**Region:** `us-central1`

### **Backend URLs**

#### Cloud Run Service URLs (Dev)
The backend service can be accessed via multiple URL formats (Cloud Run supports both):

1. **Alphanumeric format (primary):**
   ```
   https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
   ```

2. **Numeric format (alternative):**
   ```
   https://deliveryos-backend-p6bkgryxqa-uc.a.run.app (correct URL)
   ```

Both URLs point to the same service. Use the alphanumeric format as the primary URL.

#### API Base URL
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

---

## 📋 Deployment Steps

### 1. Backend Deployment

```bash
# Navigate to project root
cd /Users/maria/dial-a-drink

# Deploy backend
./deploy-backend.sh
```

**What this does:**
- Builds Docker image: `gcr.io/drink-suite/deliveryos-backend`
- Deploys to Cloud Run service: `deliveryos-backend`
- Preserves existing environment variables
- Sets `NODE_ENV=production`

**Verify deployment:**
```bash
# Get service URL
gcloud run services describe deliveryos-backend \
  --project drink-suite \
  --region us-central1 \
  --format="value(status.url)"

# Test health endpoint
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
```

### 2. Frontend Deployment (Customer Site)

**Netlify Production URL:**
```
https://dialadrink.thewolfgang.tech
```

**Backend API URL to use:**
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

**Deploy:**
```bash
./deploy-frontend.sh
```

### 3. Admin Frontend Deployment

**Netlify Production URL:**
```
https://dialadrink-admin.thewolfgang.tech
```

**Backend API URL to use:**
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

**Deploy:**
```bash
./deploy-admin.sh
```

---

## 🔧 Configuration Files

### Backend CORS Configuration
The backend (`backend/app.js`) is configured to allow requests from:

- ✅ `https://dialadrink.thewolfgang.tech` (Customer site)
- ✅ `https://dialadrink-admin.thewolfgang.tech` (Admin site)
- ✅ `https://*.netlify.app` (Netlify preview deployments)
- ✅ `https://*.thewolfgang.tech` (All thewolfgang.tech subdomains)

### Frontend API Configuration

**Customer Frontend** (`frontend/src/utils/backendUrl.js`):
- Should point to: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

**Admin Frontend** (`admin-frontend/src/services/api.js`):
- Should point to: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

---

## ✅ Verification Checklist

After deployment, verify:

1. **Backend is accessible:**
   ```bash
   curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
   ```

2. **Frontend can connect to backend:**
   - Open browser console on customer site
   - Check for API calls to `deliveryos-backend-p6bkgryxqa-uc.a.run.app`
   - No CORS errors should appear

3. **Admin site can connect:**
   - Open browser console on admin site
   - Check for API calls to `deliveryos-backend-p6bkgryxqa-uc.a.run.app`
   - No 401 errors should appear (unless not logged in)

4. **Socket.IO connections:**
   - Check browser console for WebSocket connections
   - Should connect to: `wss://deliveryos-backend-p6bkgryxqa-uc.a.run.app/socket.io/`

---

## 🚨 Common Issues

### Issue: 401 Unauthorized Errors
**Cause:** Frontend pointing to wrong backend or admin context initializing on customer pages  
**Fix:** 
- Verify frontend API URL configuration
- Check `AdminContext` only initializes on `/admin/*` routes

### Issue: CORS Errors
**Cause:** Backend CORS not configured for frontend origin  
**Fix:**
- Add frontend origin to `allowedOrigins` in `backend/app.js`
- Redeploy backend

### Issue: Wrong Backend URL
**Cause:** Frontend configured with old/incorrect backend URL  
**Fix:**
- Update `frontend/src/utils/backendUrl.js`
- Update `admin-frontend/src/services/api.js`
- Rebuild and redeploy frontends

---

## 📝 Quick Reference

| Component | Service Name | URL |
|-----------|-------------|-----|
| **Backend (Dev)** | `deliveryos-backend` | `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app` |
| **Customer Frontend** | Netlify | `https://dialadrink.thewolfgang.tech` |
| **Admin Frontend** | Netlify | `https://dialadrink-admin.thewolfgang.tech` |
| **API Base** | - | `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api` |

---

## 🔄 Deployment Workflow

1. **Make code changes**
2. **Test locally** (if possible)
3. **Deploy backend:**
   ```bash
   ./deploy-backend.sh
   ```
4. **Wait for backend to be ready** (~2-3 minutes)
5. **Deploy frontends:**
   ```bash
   ./deploy-frontend.sh
   ./deploy-admin.sh
   ```
6. **Verify deployment** using checklist above

---

## 📞 Support

If you encounter issues:
1. Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" --limit 50`
2. Check Netlify deployment logs
3. Verify environment variables are set correctly
4. Check CORS configuration matches frontend origins

---

**Last Updated:** $(date +"%Y-%m-%d")  
**Maintained by:** Development Team




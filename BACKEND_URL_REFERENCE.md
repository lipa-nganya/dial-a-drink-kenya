# Backend URL Quick Reference

## 🎯 Cloud (Dev) Environment

### Primary Backend Service
**Service Name:** `deliveryos-backend`  
**Primary URL:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`  
**API Base:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

### Alternative URL (Same Service - DO NOT USE)
**Numeric Format:** `https://deliveryos-backend-910510650031.us-central1.run.app` (deprecated, use primary URL)

---

## 📍 Where to Use This URL

### ✅ Use This Backend URL For:
- Customer frontend API calls
- Admin frontend API calls
- Socket.IO connections
- M-Pesa callbacks (configured in M-Pesa dashboard)
- All production/dev deployments

### ❌ Do NOT Use:
- `dialadrink-backend-*` (different service, if exists)
- `localhost:5001` (local development only)
- Any other backend URLs unless explicitly documented

---

## 🔧 Configuration Locations

### Frontend Configuration
**File:** `frontend/src/utils/backendUrl.js`  
**Should return:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`

### Admin Frontend Configuration
**File:** `admin-frontend/src/services/api.js`  
**Should use:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

### Backend CORS Configuration
**File:** `backend/app.js`  
**Already configured for:** `https://dialadrink.thewolfgang.tech` and `https://dialadrink-admin.thewolfgang.tech`

### M-Pesa Callback URL
**File:** `backend/services/mpesa.js`  
**Production callback:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/mpesa/callback`

---

## 🚀 Deployment Command

```bash
# Deploy to the correct backend service
./deploy-backend.sh
```

This automatically deploys to `deliveryos-backend` service.

---

## ✅ Verification

After deployment, verify the URL:
```bash
gcloud run services describe deliveryos-backend \
  --project drink-suite \
  --region us-central1 \
  --format="value(status.url)"
```

Should return: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`

---

**⚠️ IMPORTANT:** Always use `deliveryos-backend-p6bkgryxqa-uc.a.run.app` for cloud/dev deployments.




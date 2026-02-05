# Deployment Checklist

## Before ANY Deployment

### 1. CORS Configuration Check
- [ ] Verify ALL production domains are in `backend/app.js` allowedOrigins:
  - `https://ruakadrinksdelivery.co.ke`
  - `https://www.ruakadrinksdelivery.co.ke`
  - `https://admin.ruakadrinksdelivery.co.ke`
  - `https://www.admin.ruakadrinksdelivery.co.ke`
  - `https://drinksdeliverykenya.com`
  - `https://www.drinksdeliverykenya.com`
- [ ] Verify ALL development domains are in `backend/app.js` allowedOrigins:
  - `https://dialadrink.thewolfgang.tech`
  - `https://dialadrink-admin.thewolfgang.tech`
- [ ] Verify pattern matching works for subdomains (`.ruakadrinksdelivery.co.ke`, `.thewolfgang.tech`)
- [ ] Check `backend/server.js` Socket.IO CORS matches `backend/app.js` CORS

### 2. Environment-Specific Changes
- [ ] If changing CORS, deploy to BOTH development AND production
- [ ] If changing backend URLs, update BOTH frontend environments
- [ ] If changing environment variables, update BOTH Cloud Build configs

### 3. Backend Deployment
- [ ] Deploy to development: `gcloud builds submit --config cloudbuild-dev.yaml`
- [ ] Deploy to production: `gcloud builds submit --config cloudbuild.yaml`
- [ ] Wait for both deployments to complete
- [ ] Check Cloud Run logs for errors

### 4. Frontend Deployment
- [ ] Verify frontend builds without errors
- [ ] Check Netlify/GCloud deployment status
- [ ] Test on both development and production domains

### 5. Testing After Deployment
- [ ] Test customer site on development domain
- [ ] Test customer site on production domain
- [ ] Test admin site on development domain
- [ ] Test admin site on production domain
- [ ] Check browser console for CORS errors
- [ ] Verify API calls work from both environments

## Common Issues to Avoid

1. **CORS Errors**: Always update both `backend/app.js` AND `backend/server.js` (Socket.IO)
2. **Environment Mismatch**: Development backend must allow development frontends, production backend must allow production frontends
3. **Missing Domains**: When adding new domains, add to BOTH development and production CORS configs
4. **Deployment Order**: Deploy backend FIRST, then frontend (frontend needs backend to be ready)

## Recent CORS Fixes

### February 2nd, 2026 - CORS Preflight Request Fix

**Issue**: CORS errors on development site (`dialadrink.thewolfgang.tech`) after deployments. OPTIONS preflight requests were not receiving CORS headers.

**Root Cause**: 
- CORS middleware was checking origin AFTER handling OPTIONS requests
- Logic wasn't correctly identifying `https://dialadrink.thewolfgang.tech` as allowed origin
- OPTIONS preflight requests weren't getting headers set before response ended

**Fix Applied**:
- Refactored CORS middleware in `backend/app.js` to handle OPTIONS requests FIRST
- Created `isOriginAllowed()` helper function to centralize origin checking logic
- Ensured CORS headers are set correctly for all allowed origins, including `.thewolfgang.tech` subdomains
- Added better logging for debugging CORS issues

**Files Changed**:
- `backend/app.js` - CORS middleware refactoring (lines 72-127)

**Deployment**:
- Committed: `a4a14af` - "Fix CORS middleware: Handle OPTIONS preflight requests correctly for thewolfgang.tech domains"
- Deployed to: Development backend (`deliveryos-development-backend`)
- Status: ✅ Verified working via curl test - CORS headers correctly set

**Verification**:
```bash
curl -k -X OPTIONS -H "Origin: https://dialadrink.thewolfgang.tech" \
  -H "Access-Control-Request-Method: POST" \
  -i https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api/orders/find-all
```

**Result**: Returns proper CORS headers:
- `access-control-allow-origin: https://dialadrink.thewolfgang.tech`
- `access-control-allow-credentials: true`
- `access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `access-control-allow-headers: Content-Type, Authorization`

## Quick Fix Commands

```bash
# Deploy development backend
cd backend && git checkout develop && gcloud builds submit --config cloudbuild-dev.yaml .

# Deploy production backend  
cd backend && git checkout main && gcloud builds submit --config cloudbuild.yaml .

# Check current CORS config
grep -A 50 "allowedOrigins" backend/app.js
grep -A 30 "socketAllowedOrigins" backend/server.js
```

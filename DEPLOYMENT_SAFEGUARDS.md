# Deployment Safeguards & Best Practices

## 🚨 What Went Wrong (January 2026)

### Root Causes

1. **Duplicate Variable Declaration**
   - **Error**: `paymentProvider` declared twice in `routes/mpesa.js` (lines 162 and 185)
   - **Impact**: Backend crashed on startup with `Identifier 'paymentProvider' has already been declared`
   - **Why it happened**: Code refactoring without proper validation
   - **Fix**: Removed duplicate declaration

2. **CORS Configuration Conflicts**
   - **Error**: Multiple CORS middleware implementations conflicting
   - **Impact**: CORS headers not being sent, frontend blocked
   - **Why it happened**: Multiple attempts to fix CORS without removing old code
   - **Fix**: Removed `cors` package, using explicit headers only

3. **Netlify Environment Variables**
   - **Error**: `REACT_APP_API_URL` set to `http://localhost:5001/api` in Netlify
   - **Impact**: Misleading console logs (though code correctly ignored it)
   - **Why it happened**: Environment variable set incorrectly in Netlify dashboard
   - **Fix**: Code now hardcodes production URL for Netlify deployments

## 🛡️ Safeguards Implemented

### 1. Pre-Deployment Validation Script

**File**: `backend/pre-deploy-check.sh`

**What it checks**:
- ✅ JavaScript syntax errors
- ✅ Duplicate variable declarations (especially in critical files)
- ✅ Missing npm dependencies
- ✅ CORS configuration
- ✅ Hardcoded localhost URLs
- ✅ Sensitive data in console.logs

**Usage**:
```bash
cd backend
./pre-deploy-check.sh
```

**Integration**: Add to `deploy-backend.sh` before deployment

### 2. Deployment Checklist

**Before Every Deployment**:

- [ ] Run `./backend/pre-deploy-check.sh`
- [ ] Run `npm test` (if tests exist)
- [ ] Check for linting errors: `npm run lint` (if configured)
- [ ] Verify environment variables are set correctly
- [ ] Check Cloud Run logs after deployment for errors
- [ ] Test health endpoint: `curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health`
- [ ] Verify CORS headers are present

### 3. Code Review Guidelines

**For New Agents/Developers**:

1. **Always run pre-deploy checks** before deploying
2. **Never commit duplicate variable declarations** - use search before declaring
3. **Test locally first** - start backend locally and verify it runs
4. **Check Cloud Run logs immediately after deployment** - don't assume it worked
5. **Verify CORS** - test from frontend after backend deployment

### 4. Common Mistakes to Avoid

#### ❌ DON'T:
- Declare variables twice in the same scope
- Mix multiple CORS implementations
- Hardcode localhost URLs in production code
- Deploy without running validation checks
- Ignore Cloud Run startup errors

#### ✅ DO:
- Run `pre-deploy-check.sh` before every deployment
- Check Cloud Run logs after deployment
- Use explicit CORS headers (no conflicting packages)
- Test health endpoint after deployment
- Remove duplicate code before deploying

## 📋 Deployment Process (Updated)

### Backend Deployment

```bash
# 1. Pre-deployment checks
cd backend
./pre-deploy-check.sh

# 2. If checks pass, deploy
cd ..
./deploy-backend.sh

# 3. Post-deployment verification
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health

# 4. Check logs for errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" --limit 50 --format="table(timestamp,textPayload)" --project drink-suite
```

### Frontend Deployment (Netlify)

1. **Code changes** are automatically deployed via git push
2. **Wait for Netlify build** to complete (check dashboard)
3. **Verify** no build errors in Netlify logs
4. **Test** the deployed site

## 🔍 How to Detect Issues Early

### 1. Check Backend Logs After Deployment

```bash
# Check recent logs for errors
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" \
  --limit 20 \
  --format="table(timestamp,textPayload)" \
  --project drink-suite | grep -i "error\|fail\|crash"
```

### 2. Health Check Endpoint

```bash
# Should return 200 OK
curl -I https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
```

### 3. CORS Verification

```bash
# Check if CORS headers are present
curl -H "Origin: https://dialadrink.thewolfgang.tech" \
  -I https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health | grep -i "access-control"
```

## 🚀 Quick Reference

### Critical Files to Check Before Deployment

1. **`backend/routes/mpesa.js`** - Check for duplicate declarations
2. **`backend/app.js`** - Verify CORS configuration
3. **`frontend/src/services/api.js`** - Verify API URL configuration
4. **`admin-frontend/src/services/api.js`** - Verify API URL configuration

### Common Error Patterns

```bash
# Find duplicate const/let/var declarations
grep -r "const\|let\|var" backend/routes/ | awk '{print $2}' | sort | uniq -d

# Find hardcoded localhost URLs
grep -r "localhost:5001" backend/routes/ backend/services/

# Find CORS-related code
grep -r "cors\|CORS\|Access-Control" backend/app.js
```

## 📝 For New Team Members

**Before your first deployment**:

1. Read this document
2. Run `./backend/pre-deploy-check.sh` locally
3. Deploy to a test environment first (if available)
4. Check logs immediately after deployment
5. Test the health endpoint
6. Verify frontend can connect

**If deployment fails**:

1. Check Cloud Run logs immediately
2. Look for syntax errors or duplicate declarations
3. Run pre-deploy checks locally to reproduce
4. Fix the issue
5. Re-deploy and verify

## ✅ Success Criteria

A successful deployment means:

- ✅ Backend starts without errors (check logs)
- ✅ Health endpoint returns 200 OK
- ✅ CORS headers are present for frontend origins
- ✅ Frontend can make API calls successfully
- ✅ No duplicate variable errors in logs

---

**Last Updated**: January 2026  
**Maintained By**: Development Team

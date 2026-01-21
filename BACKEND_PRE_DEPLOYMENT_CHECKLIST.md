# ⚠️ Backend Pre-Deployment Checklist

**Use this checklist BEFORE every deployment to prevent common errors.**

## ✅ Quick Pre-Deployment Review (5 minutes)

### 1. Check for New/Modified Endpoints
```bash
# Review recent changes to routes
git diff main backend/routes/ | grep -E "(findAll|findByPk|include)" | head -20
```

- [ ] Any new `db.Model.findAll()` without explicit `attributes`?
- [ ] Any new `db.Model.findByPk()` without explicit `attributes`?
- [ ] Any new `include` statements without `attributes`?
- [ ] Any Admin login changes (should use raw SQL)?

### 2. Critical Endpoints to Review

Check these files for explicit attributes:
- [ ] `backend/routes/drinks.js` - All Drink queries
- [ ] `backend/routes/orders.js` - All Order queries
- [ ] `backend/routes/admin.js` - Admin login (should use raw SQL)
- [ ] `backend/routes/brands.js` - Brand queries
- [ ] `backend/routes/categories.js` - Category queries

### 3. Error Handling Check

- [ ] All `catch` blocks check `res.headersSent` before sending responses?
- [ ] No double response attempts?

### 4. Test Locally

```bash
# Start local backend
cd backend && npm start

# In another terminal, test endpoints:
curl http://localhost:5001/api/health
curl http://localhost:5001/api/drinks | jq 'length'
curl -X POST http://localhost:5001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq
```

- [ ] All endpoints return expected status codes (not 500)?
- [ ] No errors in local console?

### 5. Ready to Deploy?

- [ ] All checklist items above are checked ✅
- [ ] Code reviewed for explicit attributes
- [ ] Local tests passing
- [ ] Ready to deploy

---

## 🚀 Deploy

```bash
./deploy-backend.sh
```

---

## 🔍 Post-Deployment (2 minutes)

```bash
# Test critical endpoints immediately
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health
curl -k -X POST https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq

# Expected: {"success":false,"error":"Invalid username or password"} (401, not 500)
```

- [ ] Health endpoint returns 200?
- [ ] Admin login returns 401 (not 500)?
- [ ] No `errorMissingColumn` errors in logs?

---

**See `BACKEND_DEPLOYMENT_GUIDE.md` for detailed information.**

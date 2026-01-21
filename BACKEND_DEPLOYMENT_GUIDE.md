# Backend Deployment Guide - Preventing Common Errors

## ⚠️ CRITICAL: Read This Before Every Deployment

This guide prevents common deployment errors that cause `errorMissingColumn` and other database query issues.

---

## 📋 Pre-Deployment Checklist

### 1. **Sequelize Query Best Practices**

#### ✅ ALWAYS Use Explicit Attributes

**❌ WRONG:**
```javascript
// This will fail if columns don't exist in cloud DB
const drink = await db.Drink.findByPk(id);
const order = await db.Order.findAll({
  include: [{ model: db.OrderItem, as: 'items' }]
});
```

**✅ CORRECT:**
```javascript
// Explicitly list all attributes
const drink = await db.Drink.findByPk(id, {
  attributes: [
    'id', 'name', 'description', 'price', 'image', 'categoryId', 
    'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 
    'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
    'capacity', 'capacityPricing', 'abv', 'barcode', 'stock',
    'createdAt', 'updatedAt'
  ]
});

const order = await db.Order.findAll({
  attributes: ['id', 'customerName', 'customerPhone', 'totalAmount', /* ... */],
  include: [{
    model: db.OrderItem,
    as: 'items',
    attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'],
    include: [{
      model: db.Drink,
      as: 'drink',
      attributes: ['id', 'name', 'description', 'price', /* ... */],
      required: false
    }]
  }]
});
```

#### ✅ For Dynamic Column Selection (When Schema May Differ)

**Use Raw SQL or Dynamic Attribute Selection:**

```javascript
// Get actual columns that exist in the database
const [existingColumns] = await db.sequelize.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY column_name"
);
const columnNames = new Set(existingColumns.map(col => col.column_name.toLowerCase()));

// Map model attributes to database column names
const validAttributes = [];
for (const [attrName, attrDef] of Object.entries(db.Order.rawAttributes)) {
  const dbColumnName = attrDef.field || attrName;
  if (columnNames.has(dbColumnName.toLowerCase())) {
    validAttributes.push(attrName);
  }
}

const orders = await db.Order.findAll({
  attributes: validAttributes,
  // ... rest of query
});
```

### 2. **Common Models Requiring Explicit Attributes**

When working with these models, **ALWAYS** specify explicit attributes:

#### **Drink Model**
```javascript
attributes: [
  'id', 'name', 'description', 'price', 'image', 'categoryId', 
  'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 
  'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
  'capacity', 'capacityPricing', 'abv', 'barcode', 'stock',
  'createdAt', 'updatedAt'
]
```

#### **Order Model**
Use dynamic column selection (see example above) OR explicitly list:
```javascript
attributes: [
  'id', 'customerName', 'customerPhone', 'customerEmail', 
  'deliveryAddress', 'totalAmount', 'tipAmount', 'status', 
  'paymentStatus', 'paymentType', 'paymentMethod', 'driverId',
  'driverAccepted', 'notes', 'branchId', 'createdAt', 'updatedAt'
]
```

#### **OrderItem Model**
```javascript
attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt']
```

#### **Admin Model (Login Endpoint)**
**CRITICAL:** Use raw SQL for login to avoid column errors:
```javascript
// Use raw SQL query - only select columns that definitely exist
const results = await db.sequelize.query(
  `SELECT id, username, email, password, role, "createdAt", "updatedAt" 
   FROM admins 
   WHERE username = :username OR email = :username
   LIMIT 1`,
  {
    replacements: { username: trimmedUsername },
    type: db.sequelize.QueryTypes.SELECT
  }
);

// Explicitly set optional columns to null in response
return res.json({
  success: true,
  user: {
    id: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    role: adminUser.role || 'admin',
    name: null, // Not needed for login
    mobileNumber: null, // Not needed for login
    // ...
  }
});
```

### 3. **Endpoints That Must Have Explicit Attributes**

These endpoints **MUST** have explicit attributes before deployment:

- ✅ `GET /api/drinks` - Already fixed
- ✅ `GET /api/drinks/:id` - Already fixed
- ✅ `GET /api/brands` - Already fixed
- ✅ `GET /api/categories` - Check includes
- ✅ `POST /api/orders/find-all` - Already fixed
- ✅ `GET /api/orders/:id` - Already fixed
- ✅ `GET /api/orders/track/:token` - Already fixed
- ✅ `GET /api/orders/:id/receipt` - Already fixed
- ✅ `POST /api/admin/auth/login` - Already fixed (uses raw SQL)

### 4. **Error Handling Best Practices**

**ALWAYS** check `res.headersSent` before sending responses:

```javascript
catch (error) {
  // Don't send response if headers have already been sent
  if (res.headersSent) {
    console.error('Error (headers already sent):', error);
    return;
  }
  
  console.error('Error:', error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Failed to process request' });
  }
}
```

### 5. **Testing Before Deployment**

#### **Local Testing Checklist**

```bash
# 1. Test all critical endpoints locally
curl http://localhost:5001/api/health
curl http://localhost:5001/api/drinks
curl http://localhost:5001/api/categories

# 2. Test admin login
curl -X POST http://localhost:5001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 3. Test order endpoints
curl -X POST http://localhost:5001/api/orders/find-all \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

#### **Cloud Database Testing**

Before deploying, test queries against Cloud SQL:

```bash
# Connect to Cloud SQL
export DATABASE_URL='postgres://user:pass@host:5432/database'

# Test critical queries
cd backend
node -e "
const db = require('./models');
(async () => {
  try {
    // Test admin login query
    const results = await db.sequelize.query(
      'SELECT id, username, email, password, role FROM admins LIMIT 1',
      { type: db.sequelize.QueryTypes.SELECT }
    );
    console.log('✅ Admin query works:', results.length > 0);
    
    // Test drink query
    const drinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'price'],
      limit: 1
    });
    console.log('✅ Drink query works:', drinks.length > 0);
    process.exit(0);
  } catch (err) {
    console.error('❌ Query failed:', err.message);
    process.exit(1);
  }
})();
"
```

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Checks

```bash
# 1. Verify you're in the correct directory
cd /Users/maria/dial-a-drink

# 2. Check git status (optional but recommended)
git status

# 3. Review recent changes to routes/
git diff backend/routes/
```

### Step 2: Deploy Backend

```bash
# Deploy using the deployment script
./deploy-backend.sh
```

**Expected output:**
```
🚀 Deploying Backend to Google Cloud Run...
📋 Target Service: deliveryos-backend (Cloud/Dev)

📦 Building container image...
🚀 Deploying to Cloud Run...

✅ Backend deployed successfully!
📋 Service URL:
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

### Step 3: Post-Deployment Verification

#### **Immediate Tests (Within 2 minutes of deployment)**

```bash
# Test health endpoint
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health

# Test admin login (should return 401, not 500)
curl -k -X POST https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq

# Expected: {"success":false,"error":"Invalid username or password"}
# NOT: {"error":"..."} with status 500

# Test drinks endpoint
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/drinks | jq 'length'

# Test categories endpoint
curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/categories | jq 'length'
```

#### **Full Endpoint Test Script**

Create and run this test script after deployment:

```bash
#!/bin/bash
# test-backend-endpoints.sh

BASE_URL="https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api"
PASS=0
FAIL=0

test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected_status=$4
  
  if [ -z "$data" ]; then
    response=$(curl -k -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
  else
    response=$(curl -k -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_status" ]; then
    echo "✅ $method $endpoint - Status: $http_code"
    ((PASS++))
  else
    echo "❌ $method $endpoint - Expected: $expected_status, Got: $http_code"
    echo "   Response: $body"
    ((FAIL++))
  fi
}

echo "🧪 Testing Backend Endpoints..."
echo ""

# Test critical endpoints
test_endpoint "GET" "/health" "" "200"
test_endpoint "GET" "/drinks" "" "200"
test_endpoint "GET" "/categories" "" "200"
test_endpoint "GET" "/brands" "" "200"
test_endpoint "POST" "/admin/auth/login" '{"username":"test","password":"test"}' "401"

echo ""
echo "📊 Results: $PASS passed, $FAIL failed"
```

### Step 4: Check Cloud Run Logs

```bash
# View recent logs
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" \
  --limit=50 \
  --project=drink-suite \
  --format="table(timestamp,severity,textPayload)" \
  | head -30

# Check for errors specifically
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend AND severity>=ERROR" \
  --limit=20 \
  --project=drink-suite \
  --format="table(timestamp,severity,textPayload)"
```

### Step 5: Monitor for 5 Minutes

After deployment, monitor logs for:
- ❌ `errorMissingColumn`
- ❌ `column "..." does not exist`
- ❌ `Cannot set headers after they are sent`
- ❌ Any 500 errors from known endpoints

If you see these errors, **DO NOT** proceed with frontend deployment.

---

## 🔧 Common Error Fixes

### Error 1: `errorMissingColumn: column "name" does not exist`

**Cause:** Admin model includes `name` column that doesn't exist in cloud DB.

**Fix:** Use raw SQL for admin login (already implemented in `routes/admin.js`).

### Error 2: `errorMissingColumn: column "purchasePrice" does not exist`

**Cause:** Drink queries implicitly select all columns including `purchasePrice`.

**Fix:** Always explicitly list attributes in Drink queries:
```javascript
attributes: ['id', 'name', 'price', /* ... */] // Exclude purchasePrice if not needed
```

### Error 3: `Cannot set headers after they are sent`

**Cause:** Multiple response attempts or async errors after response sent.

**Fix:** Always check `res.headersSent` before sending responses:
```javascript
if (res.headersSent) return;
res.json({ ... });
```

### Error 4: Nested Include Missing Attributes

**Cause:** Includes without explicit attributes try to select all columns.

**Fix:** Always specify attributes for nested models:
```javascript
include: [{
  model: db.OrderItem,
  as: 'items',
  attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price'],
  include: [{
    model: db.Drink,
    as: 'drink',
    attributes: ['id', 'name', 'price', /* ... */]
  }]
}]
```

---

## 🚨 Rollback Procedure

If deployment causes errors:

### Quick Rollback (Latest Revision)

```bash
# List revisions
gcloud run revisions list --service deliveryos-backend --project drink-suite

# Rollback to previous revision
gcloud run services update-traffic deliveryos-backend \
  --to-revisions=PREVIOUS_REVISION_NAME=100 \
  --project drink-suite \
  --region us-central1
```

### Full Rollback (Redeploy Previous Code)

```bash
# 1. Checkout previous commit
git log --oneline -10
git checkout <previous-commit-hash>

# 2. Redeploy
./deploy-backend.sh

# 3. Verify fix
# (run post-deployment tests)

# 4. Restore to latest code after fixing
git checkout main
```

---

## 📝 New Endpoint Checklist

When adding a **NEW** endpoint, ensure:

- [ ] Explicit `attributes` for main model
- [ ] Explicit `attributes` for all `include` models
- [ ] Nested includes have explicit attributes
- [ ] Error handling checks `res.headersSent`
- [ ] Tested locally against local database
- [ ] Tested against Cloud SQL (if possible)
- [ ] Tested in Cloud Run after deployment

---

## 🔍 Pre-Deployment Code Review Checklist

Before deploying, review your changes for:

- [ ] Any new `db.Model.findAll()` or `db.Model.findByPk()` calls
- [ ] Any new `include` statements without `attributes`
- [ ] Any queries using `Admin` model (use raw SQL for login)
- [ ] Any error handlers without `res.headersSent` checks
- [ ] Any endpoints that query `Drink`, `Order`, `OrderItem`, `Category`, or `Brand`

---

## 📚 Reference: Fixed Endpoints

The following endpoints have been fixed and serve as reference examples:

- `backend/routes/drinks.js` - `/drinks` and `/drinks/:id`
- `backend/routes/brands.js` - `/brands`
- `backend/routes/orders.js` - `/orders/find-all`, `/orders/:id`, `/orders/track/:token`, `/orders/:id/receipt`
- `backend/routes/admin.js` - `/admin/auth/login` (uses raw SQL)

---

## 💡 Quick Reference

### Deployment Command
```bash
./deploy-backend.sh
```

### Test Admin Login
```bash
curl -k -X POST https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
```

### View Service URL
```bash
gcloud run services describe deliveryos-backend \
  --project drink-suite \
  --region us-central1 \
  --format="value(status.url)"
```

### View Recent Logs
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" \
  --limit=20 \
  --project drink-suite \
  --format="table(timestamp,severity,textPayload)"
```

---

## ⚠️ Remember

1. **Explicit attributes = No surprises**
2. **Test locally first**
3. **Test in cloud immediately after deployment**
4. **Monitor logs for 5 minutes after deployment**
5. **If in doubt, use dynamic column selection**

---

**Last Updated:** Based on deployment fixes from January 2025  
**Maintained By:** Backend Team  
**Questions?** Refer to fixed endpoints in `backend/routes/` as examples.

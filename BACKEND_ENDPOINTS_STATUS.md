# Backend Endpoints Status for Android App

## ✅ Endpoints That Exist and Are Deployed

### Admin Authentication
- ✅ `POST /api/admin/auth/login` - Username/password login (exists)
- ✅ `POST /api/admin/auth/mobile-login` - Phone/PIN login (just added, needs deployment)

### Admin Orders
- ✅ `GET /api/admin/orders` - Get all orders (exists at line 1119)
- ✅ `PATCH /api/admin/orders/:id/driver` - Assign driver to order (exists at line 2217)
- ✅ `PATCH /api/admin/orders/:id` - Update order status (exists)
- ✅ `PATCH /api/admin/orders/:orderId/items/:itemId/price` - Update item price (exists at line 1222)
- ✅ `PATCH /api/admin/orders/:orderId/delivery-fee` - Update delivery fee (exists at line 1310)

### Settings
- ✅ `GET /api/settings/:key` - Get setting by key (exists at line 64 in settings.js)
- ✅ `PUT /api/settings/:key` - Update setting by key (exists at line 149 in settings.js)
- ✅ Works for: `loanDeductionFrequency` and `loanDeductionAmount`

### Drivers
- ✅ `GET /api/drivers` - Get all drivers (exists at line 1090 in drivers.js)

### POS
- ✅ `GET /api/pos/customer/:phone` - Get POS customer (exists)
- ✅ `POST /api/pos/customer` - Create POS customer (exists)
- ✅ `GET /api/pos/drinks` - Get POS drinks (exists)

## 🚀 Deployment Required

### New Endpoint Added
1. **`POST /api/admin/auth/mobile-login`** - Added to `backend/routes/admin.js`
   - Accepts: `{ phone: string, pin: string }`
   - Returns: Same format as regular login
   - Uses: `normalizePhoneNumber` from `utils/customerSync`
   - Checks: `mobileNumber` and `pinHash` fields in Admin model

## 📋 Verification Checklist

Before deploying to production, verify:

1. ✅ Admin model has `mobileNumber` and `pinHash` fields
2. ✅ `normalizePhoneNumber` function is available (from `utils/customerSync`)
3. ✅ All other endpoints are already deployed
4. ⚠️ **NEW**: `/api/admin/auth/mobile-login` endpoint needs to be deployed

## 🔧 Deployment Steps

1. **Commit the new endpoint**:
   ```bash
   git add backend/routes/admin.js
   git commit -m "Add admin mobile login endpoint (phone + PIN)"
   ```

2. **Deploy to production backend**:
   - The endpoint is in `backend/routes/admin.js` at line ~392
   - It's placed before `router.use(verifyAdmin)` so it doesn't require authentication
   - Uses the same JWT_SECRET and ADMIN_TOKEN_TTL as regular login

3. **Test the endpoint**:
   ```bash
   curl -X POST https://deliveryos-production-backend-805803410802.us-central1.run.app/api/admin/auth/mobile-login \
     -H "Content-Type: application/json" \
     -d '{"phone": "254712345678", "pin": "1234"}'
   ```

## 📝 Notes

- All other endpoints the Android app uses are already in the backend
- The mobile-login endpoint follows the same pattern as shop agent mobile login
- Phone number normalization handles: +254, 254, 0, and 9-digit formats
- PIN must be exactly 4 digits

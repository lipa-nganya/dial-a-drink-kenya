# Backend API Standardization Plan

## Goal
Standardize ALL backend API responses to use `sendSuccess`/`sendError` from `backend/utils/apiResponse.js` to ensure consistent format:
```json
{
  "success": true,
  "data": <response_data>,
  "message": "optional message"
}
```

## Critical Driver App Endpoints (Fix First)

### ✅ Fixed
- `GET /api/driver-orders/:driverId` - Now uses `sendSuccess`
- `GET /api/driver-orders/:driverId/pending` - Already uses `sendSuccess`
- `POST /api/driver-orders/:orderId/respond` - Already uses `sendSuccess`

### 🔧 Need to Fix

#### `/api/drivers/*` (drivers.js)
- `GET /api/drivers/phone/:phoneNumber` - Currently uses `res.json()` directly
- `POST /api/drivers/phone/:phone/verify-otp` - Need to check
- `POST /api/drivers/phone/:phone/verify-pin` - Need to check
- `POST /api/drivers/phone/:phone/setup-pin` - Need to check
- `POST /api/drivers/push-token` - Currently uses `res.json()` directly
- `PATCH /api/drivers/:id/location` - Currently uses `res.json()` directly
- `PATCH /api/drivers/:id/activity` - Currently uses `res.json()` directly

#### `/api/auth/*` (auth.js)
- `POST /api/auth/send-otp` - Need to check
- All auth endpoints need standardization

#### `/api/driver-wallet/*` (driver-wallet.js)
- `GET /api/drivers/:driverId/wallet` - Currently uses `res.json()` directly
- All wallet endpoints need standardization

## Implementation Steps

1. **Add import to each route file:**
   ```javascript
   const { sendSuccess, sendError } = require('../utils/apiResponse');
   ```

2. **Replace all `res.json()` calls:**
   - `res.json(data)` → `sendSuccess(res, data)`
   - `res.json({ success: true, data: ... })` → `sendSuccess(res, ...)`
   - `res.status(200).json(data)` → `sendSuccess(res, data)`

3. **Replace all error responses:**
   - `res.status(400).json({ error: '...' })` → `sendError(res, '...', 400)`
   - `res.status(500).json({ error: '...' })` → `sendError(res, '...', 500)`

4. **Check for double-serialization:**
   - Remove any `JSON.stringify()` before `res.json()`
   - Ensure `sendSuccess`/`sendError` use `res.json()` (which they do)

## Files to Update

### Priority 1 (Driver App Critical)
- [x] `backend/routes/driver-orders.js` - Partially fixed (GET /:driverId)
- [ ] `backend/routes/drivers.js` - In progress
- [ ] `backend/routes/auth.js` - Not started
- [ ] `backend/routes/driver-wallet.js` - Not started

### Priority 2 (Other endpoints)
- [ ] All other route files

## Testing

After fixes, test:
1. All driver app endpoints return consistent format
2. No double-serialization (check response headers and body)
3. Error responses are consistent
4. Android app can parse all responses correctly

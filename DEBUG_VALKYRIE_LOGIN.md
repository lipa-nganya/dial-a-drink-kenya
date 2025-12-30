# Debugging Valkyrie Login 401 Error

## Current Status

✅ **API works when tested directly** - curl requests succeed
✅ **User exists in database** - `admin@demopartner.com` with password `admin123`
✅ **User and partner are both active**
✅ **CORS is configured correctly** - `http://localhost:3002` is allowed
✅ **Password hash is correct** - bcrypt comparison works

## What to Check

### 1. Browser Console
Open browser DevTools (F12) and check:
- **Console tab**: Look for any JavaScript errors
- **Network tab**: 
  - Find the `/auth/token` request
  - Check the **Request Payload** - verify email and password are being sent
  - Check the **Response** - see the exact error message
  - Check **Status Code** - should be 401

### 2. Backend Logs
After attempting to log in, run:
```bash
tail -40 /tmp/backend.log | grep -A 20 'Valkyrie auth'
```

This will show:
- What email/password was received
- Whether user was found
- Password comparison result
- Any errors

### 3. Common Issues

#### Issue: Password has whitespace
**Solution**: The frontend now trims email, but check if password has leading/trailing spaces

#### Issue: Email case sensitivity
**Solution**: Backend lowercases email, but verify you're typing: `admin@demopartner.com`

#### Issue: Browser caching old credentials
**Solution**: Clear browser cache or use incognito mode

#### Issue: Request not reaching backend
**Solution**: Check Network tab to see if request is being sent to correct URL

### 4. Test API Directly

```bash
curl -X POST http://localhost:5001/api/valkyrie/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demopartner.com","password":"admin123"}'
```

If this works but browser doesn't, the issue is in the frontend request format.

### 5. Verify Frontend Request

In browser Network tab, the request should look like:
```json
{
  "email": "admin@demopartner.com",
  "password": "admin123"
}
```

Check for:
- Extra quotes or encoding issues
- Missing fields
- Wrong Content-Type header

### 6. Reset Everything

If all else fails:

```bash
cd backend

# Reset user password
node -e "
const db = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  await db.sequelize.authenticate();
  const user = await db.ValkyriePartnerUser.findOne({
    where: { email: 'admin@demopartner.com' }
  });
  if (user) {
    const hash = await bcrypt.hash('admin123', 10);
    await user.update({ password: hash, status: 'active' });
    await user.partner?.update({ status: 'active' });
    console.log('✅ Password reset');
  }
  process.exit(0);
})();
"
```

## Expected Behavior

When login succeeds, you should see in backend logs:
```
Valkyrie auth request: { hasEmail: true, hasPassword: true, ... }
Looking for user with email: admin@demopartner.com
User check result: { found: true, status: 'active', ... }
Partner user query result: { found: true, partnerFound: true, ... }
Comparing password for: admin@demopartner.com
Password comparison result: ✅ MATCH
```

If you see "❌ NO MATCH", the password being sent doesn't match what's stored.











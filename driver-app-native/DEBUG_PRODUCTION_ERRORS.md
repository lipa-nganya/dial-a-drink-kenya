# Debugging Production Debug Errors

## Quick Fixes

### 1. Clean Build
```bash
cd driver-app-native
./gradlew clean
./gradlew assembleProductionDebug
```

Or in Android Studio:
- Build → Clean Project
- Build → Rebuild Project
- Select `productionDebug` variant and run

### 2. Verify API URL
Check that the production API URL is correct in `gradle.properties`:
```properties
PROD_API_BASE_URL=https://deliveryos-production-backend-805803410802.us-central1.run.app
```

### 3. Check Build Variant
In Android Studio:
- View → Tool Windows → Build Variants
- Ensure `productionDebug` is selected for the `app` module

## Common Issues

### Issue: "Unresolved reference" errors
**Cause**: Build cache or variant-specific code issues

**Solution**:
1. File → Invalidate Caches / Restart
2. Clean and rebuild
3. Check if the error is in variant-specific code

### Issue: API authentication errors
**Cause**: Production backend has different authentication requirements

**Solution**:
1. Check if production backend requires different tokens
2. Verify admin token is being sent correctly
3. Check backend logs for authentication failures

### Issue: Missing endpoints
**Cause**: Production backend might not have all endpoints deployed

**Solution**:
1. Verify endpoints exist on production:
   - `/api/admin/orders`
   - `/api/admin/auth/mobile-login`
   - `/api/settings/loanDeductionFrequency`
   - `/api/settings/loanDeductionAmount`
   - `/api/admin/orders/:id/driver`
   - `/api/drivers`
2. Check if endpoints return different response formats

### Issue: Network/CORS errors
**Cause**: Production backend might have different CORS settings

**Solution**:
1. Check network logs in Android Studio Logcat
2. Verify SSL certificate is valid
3. Check if production requires different headers

## Debugging Steps

### 1. Check Logcat
Filter by your app package: `com.dialadrink.driver`
Look for:
- API errors
- Authentication failures
- Network errors
- Null pointer exceptions

### 2. Compare API Responses
Test the same endpoint on both backends:
```bash
# Development
curl https://deliveryos-development-backend-805803410802.us-central1.run.app/api/admin/orders

# Production
curl https://deliveryos-production-backend-805803410802.us-central1.run.app/api/admin/orders
```

### 3. Check Build Config
Verify the API URL is correct at runtime:
- Add logging in `ApiClient.kt` to print `BuildConfig.API_BASE_URL`
- Check Logcat output when app starts

### 4. Test Authentication
Verify admin login works on production:
- Try logging in via the app
- Check if token is saved correctly
- Verify token is sent in API requests

## Specific Errors

### "Unresolved reference: getAdminPendingOrders"
This was fixed by adding the method to `OrderRepository.kt`. If you still see this:
1. Clean build
2. Sync Gradle
3. Rebuild

### "Authentication failed"
1. Check if admin token is being saved after login
2. Verify token format matches production backend expectations
3. Check token expiration time

### "Network error" or "Connection refused"
1. Verify production backend is running
2. Check network connectivity
3. Verify SSL certificate is valid

## Next Steps

If errors persist:
1. Share the specific error messages from Logcat
2. Check if production backend logs show any errors
3. Compare working dev/local requests with failing production requests
4. Verify all new endpoints exist on production backend

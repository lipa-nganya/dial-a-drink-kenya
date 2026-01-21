# 🔗 PesaPal IPN Dashboard Configuration

## ⚠️ Common Error: Website URL Format

When configuring IPN in PesaPal dashboard, you may get an error if the format is incorrect.

## ✅ Correct Format

### Website Domain:
```
https://homiest-psychopharmacologic-anaya.ngrok-free.dev
```
**Must include `https://` protocol**

### IPN Listener URL:
```
https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/pesapal/ipn
```

## ⚠️ Potential Issues with ngrok-free.dev

Some payment gateways don't accept `ngrok-free.dev` domains because:
1. They're temporary/random domains
2. They may have security restrictions
3. They require browser warnings

## ✅ Solutions

### Option 1: Use ngrok Paid Plan (Static Domain)
If you have ngrok paid plan, you can use a static domain:
- Website Domain: `https://your-static-domain.ngrok.io`
- IPN Listener URL: `https://your-static-domain.ngrok.io/api/pesapal/ipn`

### Option 2: Use Production Backend URL
Since you can only configure IPN in Production credentials section, use the production backend:

- Website Domain: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`
- IPN Listener URL: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn`

**Note:** This means IPN callbacks will go to production backend, which will update orders in production database.

### Option 3: Try Without Website Domain
Some PesaPal configurations only require the IPN Listener URL:
- Leave Website Domain empty or use a placeholder
- Only configure: IPN Listener URL: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/pesapal/ipn`

## 📋 Step-by-Step Configuration

1. Go to: https://developer.pesapal.com/
2. Navigate to: **Settings > IPN Settings** (in **Production** credentials section)
3. **Website Domain** (if required):
   ```
   https://homiest-psychopharmacologic-anaya.ngrok-free.dev
   ```
   OR leave empty if not required
4. **IPN Listener URL**:
   ```
   https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/pesapal/ipn
   ```
5. **IPN Notification Type**: `GET`
6. Save

## 🔍 Verify Backend is Accessible

Before configuring in PesaPal, verify your backend is accessible:

```bash
# Test the IPN endpoint
curl "https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/pesapal/ipn?OrderTrackingId=test"
```

You should get a response (even if it's an error about missing OrderTrackingId - that means the endpoint is working).

## 🐛 If You Still Get Errors

1. **Check ngrok is running:**
   ```bash
   curl http://localhost:4040/api/tunnels
   ```

2. **Verify backend is running on port 5001:**
   ```bash
   lsof -ti:5001
   ```

3. **Check backend logs** when you try to save in PesaPal dashboard

4. **Try using production backend URL** instead of ngrok (Option 2 above)

5. **Contact PesaPal support** if ngrok-free.dev domains are blocked

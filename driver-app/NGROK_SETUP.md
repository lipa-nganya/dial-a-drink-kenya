# Using Ngrok with Driver App

## Your Ngrok URL

Your existing ngrok URL is:
**`https://homiest-psychopharmacologic-anaya.ngrok-free.dev`**

## Update Driver App Configuration

1. Open `driver-app/src/services/api.js`

2. Update the `getBaseURL()` function to use your ngrok URL:

```javascript
const getBaseURL = () => {
  // For Physical Device - Ngrok
  return 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api';
  
  // Comment out or remove the Android Emulator line:
  // if (Platform.OS === 'android' && __DEV__) {
  //   return 'http://10.0.2.2:5001/api';
  // }
};
```

3. Rebuild the APK:
```bash
cd driver-app/android
./gradlew assembleDebug
```

4. Install the new APK on your device

## Managing Ngrok

### Stop Existing Ngrok Process

If you need to restart ngrok:

```bash
# Find and kill existing ngrok process
pkill -f ngrok

# Start new ngrok tunnel
ngrok http 5001
```

### Check if Ngrok is Running

```bash
ps aux | grep ngrok | grep -v grep
```

### Test Ngrok URL

Test in browser or with curl:
```bash
curl https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/health
```

Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

## Important Notes

- **Ngrok free tier:** URLs change when you restart ngrok (unless you have a paid plan)
- **Keep ngrok running:** Don't close the ngrok terminal while testing
- **Update app:** If ngrok URL changes, you need to rebuild the APK
- **Backend must be running:** Make sure `npm start` is running in the backend directory

## Alternative: Use Local Network IP

If you prefer not to use ngrok, you can use your local network IP instead:

1. Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Update `src/services/api.js` with your IP (e.g., `http://192.168.1.66:5001/api`)
3. Ensure phone and computer are on same WiFi
4. Rebuild APK




















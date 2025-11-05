# Debug Guide: Red Screen and Sound Not Working

## Common Issues and Solutions

### Issue 1: Socket Not Connected
**Symptoms:** No console logs showing "Socket.IO connected"

**Check:**
1. Open the driver app
2. Check console logs for:
   - `✅ Socket.IO connected`
   - `Joined driver room: driver-{id}`

**Fix:**
- Ensure ngrok URL in `api.js` matches the socket URL in `HomeScreen.js`
- Check if ngrok is running: `ngrok http 5001`
- Verify the backend server is running

### Issue 2: Socket URL Mismatch
**Symptoms:** Socket connects but events not received

**Check:**
- `DDDriverExpo/src/services/api.js` - Check base URL
- `DDDriverExpo/src/screens/HomeScreen.js` - Check socket URL (around line 44)

**Fix:**
Both should use the same URL (either ngrok or local network IP)

### Issue 3: Navigation Not Working
**Symptoms:** Socket event received but screen doesn't appear

**Check console logs:**
- `📦 New order assigned:` - Should appear when order is assigned
- `🚀 Navigating to OrderAcceptance screen...` - Should appear after socket event

**Fix:**
- Ensure `OrderAcceptance` screen is properly registered in `App.js`
- Check that `navigation.replace` is being called

### Issue 4: Sound/Vibration Not Playing
**Symptoms:** Red screen appears but no sound/vibration

**Check:**
- App permissions for vibration and audio
- Console logs: `📳 Vibration started` and `🚨 Playing ambulance sound`
- Ensure `playSound` is `true` in route params

### Issue 5: App in Background
**Symptoms:** Nothing happens when app is backgrounded

**Note:** The code should work in background, but may be limited by Android battery optimization

**Fix:**
- Disable battery optimization for the driver app
- Settings → Apps → DD Driver → Battery → Unrestricted

## Debug Steps

### Step 1: Check Socket Connection
```bash
# Watch logs
adb logcat | grep -i "socket\|order-assigned\|driver"

# Look for:
# ✅ Socket.IO connected
# Joined driver room: driver-{id}
```

### Step 2: Test Socket Event
When assigning an order, check backend logs:
```
📱 Emitting order-assigned event to driver {id} ({phone})
```

### Step 3: Check Driver App Logs
```bash
adb logcat | grep -i "order\|vibration\|sound\|red\|acceptance"

# Look for:
# 📦 New order assigned
# 📳 Vibration started
# 🚨 OrderAcceptanceScreen mounted
```

### Step 4: Verify Navigation
Check that `OrderAcceptance` screen is registered:
- `App.js` should have `OrderAcceptanceScreen` in Stack.Navigator
- Screen options should have `headerShown: false`

### Step 5: Test Manually
Add a test button in HomeScreen to trigger the screen manually:

```javascript
<TouchableOpacity onPress={() => {
  navigation.replace('OrderAcceptance', {
    order: { id: 999, customerName: 'Test', totalAmount: 100 },
    driverId: driverInfo.id,
    phoneNumber: phoneNumber,
    playSound: true
  });
}}>
  <Text>Test Red Screen</Text>
</TouchableOpacity>
```

## Quick Fixes

### Fix 1: Update Socket URL
If ngrok URL changed, update both files:

**api.js:**
```javascript
return 'https://YOUR-NEW-NGROK-URL.ngrok-free.dev/api';
```

**HomeScreen.js (around line 44):**
```javascript
return 'https://YOUR-NEW-NGROK-URL.ngrok-free.dev';
```

### Fix 2: Ensure Socket Reconnects
Add reconnect logic if app comes back from background:

```javascript
socket.on('disconnect', () => {
  console.log('Socket disconnected, reconnecting...');
  socket.connect();
});
```

### Fix 3: Add Debug Logs
Add more console logs to track the flow:

```javascript
socket.on('order-assigned', async (data) => {
  console.log('🔴 ORDER ASSIGNED EVENT RECEIVED');
  console.log('🔴 Data:', JSON.stringify(data, null, 2));
  console.log('🔴 Driver ID:', driverInfo?.id);
  console.log('🔴 Navigation:', navigation);
  // ... rest of code
});
```

## Verification Checklist

- [ ] Socket connects successfully
- [ ] Driver joins room: `driver-{id}`
- [ ] Backend emits event to correct room
- [ ] Driver app receives `order-assigned` event
- [ ] Navigation.replace is called
- [ ] OrderAcceptanceScreen renders
- [ ] Vibration starts
- [ ] Sound plays (if enabled)
- [ ] Red overlay appears

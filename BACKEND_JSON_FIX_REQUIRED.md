# 🚨 BACKEND FIX REQUIRED: Double-Serialized JSON

## Problem

The backend is returning **stringified JSON** (a string containing JSON) instead of raw JSON arrays/objects.

**Example of what backend returns:**
```
"[{\"id\":1,\"name\":\"Order 1\"}]"
```

**What backend SHOULD return:**
```
[{"id":1,"name":"Order 1"}]
```

## Impact

- Android app receives: `"Expected BEGIN_ARRAY but was STRING"`
- Gson sees first character as `"` → throws parsing error
- This is NOT fixable by changing Android models
- Temporary workaround implemented in Android app (see `StringifiedJsonConverter.kt`)

## Root Cause

The backend is double-serializing JSON:
1. First serialization: Object/Array → JSON string
2. Second serialization: JSON string → Stringified JSON (wrapped in quotes)

## Where to Fix

Check these locations in the backend:

1. **Express middleware** - Any middleware that might be double-serializing
2. **Response interceptors** - Any response transformation middleware
3. **Proxy/ngrok** - If using ngrok or reverse proxy, check if it's modifying responses
4. **Direct `res.json()` calls** - Ensure `res.json()` is called with objects/arrays, not strings

## Specific Endpoints Affected

- `GET /api/driver-orders/:driverId` - Returns stringified JSON array
- Any endpoint returning arrays/objects directly

## Correct Implementation

**❌ WRONG:**
```javascript
const data = JSON.stringify(orders); // Don't stringify!
res.json(data); // This double-serializes
```

**✅ CORRECT:**
```javascript
res.json(orders); // Express handles serialization
// OR
res.status(200).json(orders); // Explicit status
```

## Verification

After fixing, verify responses:
1. Response should start with `[` for arrays or `{` for objects
2. Response should NOT start with `"`
3. Content-Type header should be `application/json`
4. Response body should be valid JSON (not a JSON string)

## Android Workaround

A temporary `StringifiedJsonConverter` has been implemented in the Android app to unwrap stringified JSON. **This should be removed once the backend is fixed.**

## Priority

**HIGH** - This causes parsing failures across the app and requires a workaround that adds complexity and potential bugs.

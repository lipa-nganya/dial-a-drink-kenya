# Security Fix: Exposed Google API Key

## Issue
A Google API key (`AIzaSyBXZDQWV72dyfSCqm6Y8sr9Y2ze9Xm2eqc`) was exposed in a public GitHub repository in the file `backend/.env.bak`.

## Immediate Actions Required

### 1. Revoke the Exposed API Key
**URGENT**: Go to Google Cloud Console and revoke this key immediately:
- Project: Dial A Drink (id: dial-a-drink-477110)
- Key: `AIzaSyBXZDQWV72dyfSCqm6Y8sr9Y2ze9Xm2eqc`
- Console: https://console.cloud.google.com/apis/credentials

Steps:
1. Navigate to APIs & Services > Credentials
2. Find the key `AIzaSyBXZDQWV72dyfSCqm6Y8sr9Y2ze9Xm2eqc`
3. Click on it and select "Delete" or "Restrict" (if you want to keep it but restrict usage)
4. **Recommended**: Delete it and create a new key with proper restrictions

### 2. Create a New API Key (if needed)
If you need a replacement key:
1. Create a new API key in Google Cloud Console
2. Restrict it to:
   - **Application restrictions**: HTTP referrers (for web) or Android/iOS apps
   - **API restrictions**: Only enable the APIs you need (Places API, Maps API, etc.)
3. Set usage quotas to prevent abuse
4. Store it in environment variables (NOT in code or version control)

### 3. Remove from Git History (if repository is still public)
The file was committed in commit `34292dabe6a29ac289616f2e859e78a26aa5b3a8`.

**Option A: If repository is private now**
- The damage is limited, but you should still revoke the key

**Option B: If repository is still public**
- Consider using `git filter-branch` or BFG Repo-Cleaner to remove the file from history
- **Warning**: This rewrites git history and requires force push
- Coordinate with your team before doing this

### 4. Prevent Future Exposure
✅ **Already done**: Updated `.gitignore` files to exclude:
- `.env.bak`
- `.env.*.bak`
- `*.env.bak`

### 5. Audit Current API Keys
Check all current API keys in use:
- **Android App**: `AIzaSyBYs413EeQVcChjlgrOMFd7U2dy60xiirk` (in `strings.xml` and `AndroidManifest.xml`)
  - This key is embedded in the app, which is acceptable for Android apps
  - Ensure it has proper restrictions (Android app restrictions)
- **Backend**: Uses `GOOGLE_MAPS_API_KEY` from environment variables (correct approach)

### 6. Best Practices Going Forward
1. **Never commit** `.env`, `.env.bak`, or any files containing API keys
2. **Use environment variables** for all sensitive keys
3. **Add `.env*` patterns** to `.gitignore` (already done)
4. **Use Google Cloud API key restrictions**:
   - Application restrictions (IP addresses, HTTP referrers, Android/iOS apps)
   - API restrictions (only enable needed APIs)
   - Usage quotas
5. **Regularly audit** your repository for exposed secrets using tools like:
   - GitHub's secret scanning (if using GitHub)
   - GitGuardian
   - TruffleHog

## Current Status
- ✅ `.gitignore` updated to prevent future `.env.bak` commits
- ⚠️ Exposed key still needs to be revoked in Google Cloud Console
- ⚠️ If repository is public, consider removing from git history

## Next Steps
1. **Immediately** revoke the exposed API key in Google Cloud Console
2. Verify no unauthorized usage has occurred (check Google Cloud Console usage logs)
3. If needed, create a new restricted API key
4. Monitor for any unusual API usage

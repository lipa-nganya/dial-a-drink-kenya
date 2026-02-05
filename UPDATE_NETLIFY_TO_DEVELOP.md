# 🔧 Update Netlify to Use Develop Branch

## ✅ Status

- ✅ `develop` branch created and pushed to GitHub
- ✅ Latest commit (`d82e850`) is on `develop` branch
- ⏳ **Next Step**: Update Netlify branch settings

## 📋 Quick Steps to Update Netlify

### Customer Site: dialadrink.thewolfgang.tech

1. **Go to Netlify Dashboard**
   - URL: https://app.netlify.com/
   - Login with your Netlify account

2. **Select the Customer Site**
   - Find site: **dialadrink.thewolfgang.tech**
   - Click on it

3. **Update Branch Setting**
   - Click **Site settings** (gear icon)
   - Go to **Build & deploy** → **Continuous Deployment**
   - Under **Branch to deploy**, change from `main` to `develop`
   - Click **Save**

4. **Trigger Deployment**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This will immediately deploy from the `develop` branch

### Admin Site: dialadrink-admin.thewolfgang.tech

1. **Go to Netlify Dashboard**
   - URL: https://app.netlify.com/

2. **Select the Admin Site**
   - Find site: **dialadrink-admin.thewolfgang.tech**
   - Click on it

3. **Update Branch Setting**
   - Click **Site settings** (gear icon)
   - Go to **Build & deploy** → **Continuous Deployment**
   - Under **Branch to deploy**, change from `main` to `develop`
   - Click **Save**

4. **Trigger Deployment**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This will immediately deploy from the `develop` branch

## 🔍 Verify the Fix

After updating Netlify and deploying:

1. **Visit Customer Site**: https://dialadrink.thewolfgang.tech/
2. **Open Browser Console** (F12)
3. **Check API Configuration Logs**:
   ```
   === API CONFIGURATION ===
   API_BASE_URL: https://deliveryos-backend-910510650031.us-central1.run.app/api
   API source: netlify-dev
   Hostname: dialadrink.thewolfgang.tech
   ```
   
   ✅ Should show `netlify-dev` (not `netlify-prod-forced`)
   ✅ Should show dev backend URL (910510650031 project)

4. **Visit Admin Site**: https://dialadrink-admin.thewolfgang.tech/
5. **Check API Configuration** - should also show dev backend

## 📸 Visual Guide

### Netlify Branch Setting Location

```
Netlify Dashboard
  └─ Your Site
      └─ Site settings (⚙️ icon)
          └─ Build & deploy
              └─ Continuous Deployment
                  └─ Branch to deploy: [develop] ← Change this
```

## 🎯 What This Achieves

After updating Netlify:
- ✅ Development sites deploy from `develop` branch
- ✅ Development sites use development backend (GCP project 910510650031)
- ✅ Production sites (when set up) will use `main` branch
- ✅ Clear separation between dev and prod environments

## 🚨 Troubleshooting

### Netlify shows "Branch not found"
- Ensure you've pushed the `develop` branch: `git push -u origin develop`
- Check GitHub repository has the `develop` branch

### Deployment still uses old code
- Clear Netlify build cache: Site settings → Build & deploy → Clear cache and deploy site
- Check deploy logs to see which commit is being deployed

### API still pointing to production
- Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for API configuration logs
- Verify the deployed code includes the fix (commit d82e850)

## 📝 Summary

**Current Status:**
- ✅ `develop` branch exists on GitHub
- ✅ Latest fixes are on `develop` branch
- ⏳ **Action Required**: Update Netlify branch settings manually

**After Netlify Update:**
- Development sites will auto-deploy from `develop` branch
- Development sites will use correct backend URL
- All future development work should be on `develop` branch

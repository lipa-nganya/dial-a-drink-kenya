# 🚀 Push to Develop Branch & Update Netlify

## ✅ Step 1: Push Develop Branch to GitHub

The `develop` branch has been created locally. Push it to GitHub:

```bash
git push -u origin develop
```

If authentication is required, you can:
- Use GitHub CLI: `gh auth login` (if installed)
- Use SSH: Change remote URL to SSH format
- Use Personal Access Token: Enter token as password when prompted

## 📋 Step 2: Update Netlify to Use Develop Branch

### Customer Site (dialadrink.thewolfgang.tech)

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Select the site: **dialadrink.thewolfgang.tech**
3. Go to **Site settings** → **Build & deploy**
4. Under **Continuous Deployment**:
   - **Branch to deploy**: Change from `main` to `develop`
   - **Base directory**: `frontend` (should already be set)
   - **Build command**: `npm install && npm run build` (should already be set)
   - **Publish directory**: `frontend/build` (should already be set)
5. Click **Save**
6. Go to **Deploys** tab and click **Trigger deploy** → **Deploy site** to trigger immediate deployment

### Admin Site (dialadrink-admin.thewolfgang.tech)

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Select the site: **dialadrink-admin.thewolfgang.tech**
3. Go to **Site settings** → **Build & deploy**
4. Under **Continuous Deployment**:
   - **Branch to deploy**: Change from `main` to `develop`
   - **Base directory**: `admin-frontend` (should already be set)
   - **Build command**: `npm install && npm run build` (should already be set)
   - **Publish directory**: `admin-frontend/build` (should already be set)
5. Click **Save**
6. Go to **Deploys** tab and click **Trigger deploy** → **Deploy site** to trigger immediate deployment

## 🔍 Step 3: Verify Deployment

After pushing and updating Netlify:

1. **Check Netlify Deploys**:
   - Both sites should show new deployments from `develop` branch
   - Build should complete successfully
   - Deploy should be live

2. **Verify API Configuration**:
   - Visit: https://dialadrink.thewolfgang.tech/
   - Open browser console (F12)
   - Check API logs - should show:
     ```
     API source: netlify-dev
     API_BASE_URL: https://deliveryos-backend-910510650031.us-central1.run.app/api
     ```

3. **Test Admin Site**:
   - Visit: https://dialadrink-admin.thewolfgang.tech/
   - Open browser console (F12)
   - Check API logs - should show development backend URL

## 📝 Current Status

- ✅ `develop` branch created locally
- ✅ Latest commit (`d82e850`) is on `develop` branch
- ⏳ Waiting for: Push to GitHub
- ⏳ Waiting for: Netlify branch configuration update

## 🎯 What This Fixes

After completing these steps:
- Development sites will deploy from `develop` branch
- Development sites will use development backend (910510650031 project)
- Production sites will remain on `main` branch (when set up)
- Clear separation between development and production

## 🔄 Future Workflow

### For Development Changes:
```bash
git checkout develop
# Make changes
git add .
git commit -m "Your commit message"
git push origin develop
# Netlify will auto-deploy
```

### For Production Releases:
```bash
git checkout main
git merge develop  # or cherry-pick specific commits
git push origin main
# Production Netlify sites will auto-deploy
```

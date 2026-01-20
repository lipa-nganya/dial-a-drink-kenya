# Fix Netlify GitHub Connection

## Problem
Both customer and admin sites are not deploying from GitHub because they're not connected to the repository.

## Solution

### Step 1: Connect Customer Site to GitHub

1. Go to: https://app.netlify.com/projects/dialadrink-customer/configuration/deploys
2. Look for "Build & deploy" section
3. Click **"Link to Git provider"** or **"Connect to Git"**
4. Select **GitHub** as the provider
5. Authorize Netlify to access your GitHub account if prompted
6. Select repository: **lipa-nganya/dial-a-drink-kenya**
7. Configure build settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `frontend/build`
   - **Branch to deploy:** `main`
8. Click **"Save"**

### Step 2: Connect Admin Site to GitHub

1. Go to: https://app.netlify.com/projects/dialadrink-admin/configuration/deploys
2. Look for "Build & deploy" section
3. Click **"Link to Git provider"** or **"Connect to Git"**
4. Select **GitHub** as the provider
5. Authorize Netlify to access your GitHub account if prompted
6. Select repository: **lipa-nganya/dial-a-drink-kenya**
7. Configure build settings:
   - **Base directory:** `admin-frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `admin-frontend/build`
   - **Branch to deploy:** `main`
8. Click **"Save"**

### Step 3: Verify Auto-Deploy

After connecting:
1. Both sites should automatically deploy when you push to `main` branch
2. You can manually trigger a deployment by:
   - Going to Site → Deploys → "Trigger deploy"
   - Or pushing a new commit to GitHub

### Step 4: Test Deployment

1. Make a small change (like adding a comment)
2. Commit and push to GitHub
3. Check Netlify dashboard - you should see a new deployment starting automatically
4. Wait for build to complete (usually 2-3 minutes)
5. Verify the changes are live on the site

## Current Status

✅ Build settings have been configured via API
⚠️  GitHub connection needs to be done manually via Netlify UI (one-time setup)

## Site URLs

- **Customer Site:** https://dialadrink.thewolfgang.tech
- **Admin Site:** https://dialadrink-admin.thewolfgang.tech

## Troubleshooting

If deployments still don't trigger:
1. Check that the GitHub repository is properly connected
2. Verify build settings match exactly (case-sensitive)
3. Check Netlify build logs for errors
4. Ensure the repository is public or Netlify has access

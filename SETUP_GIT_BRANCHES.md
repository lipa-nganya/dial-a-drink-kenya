# 🌿 Git Branch Setup for Production

This guide explains how to set up the Git branch structure where:
- **`develop`** branch → Development environment
  - Customer site: https://dialadrink.thewolfgang.tech/
  - Admin site: https://dialadrink-admin.thewolfgang.tech/
  - Backend: GCP project `910510650031` (drink-suite)
  - Android: Development build
- **`main`** branch → Production environment
  - Customer site: (Production Netlify URL)
  - Admin site: (Production Netlify URL)
  - Backend: GCP project `dialadrink-production`
  - Android: Production build

## Current State

- Current `main` branch contains development code
- Need to rename `main` → `develop`
- Create new `main` branch for production

## Step 1: Rename Current Main to Develop

```bash
# Ensure you're on the main branch and have latest changes
git checkout main
git pull origin main

# Rename main branch to develop locally
git branch -m main develop

# Push the new develop branch to remote
git push origin develop

# Set develop as the default branch for development
git push origin -u develop
```

## Step 2: Create New Main Branch for Production

```bash
# Create a new main branch from develop (or from a stable tag)
git checkout develop
git checkout -b main

# Push the new main branch to remote
git push origin main

# Set main as the default branch
git push origin -u main
```

## Step 3: Update Remote Default Branch

### Option A: Using GitHub Web Interface (Recommended)

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Under **Default branch**, change from `develop` to `main`
4. Click **Update** and confirm

### Option B: Using GitHub CLI

```bash
gh repo edit --default-branch main
```

### Option C: Using Git Commands

```bash
# This requires repository admin access
# Usually done via GitHub web interface
```

## Step 4: Update Netlify Deployments

### Development Netlify Sites

1. Go to Netlify dashboard
2. For **development** sites:
   - Site settings → Build & deploy → Branch
   - Set branch to: `develop`
   - Save changes

### Production Netlify Sites

1. Go to Netlify dashboard
2. For **production** sites:
   - Site settings → Build & deploy → Branch
   - Set branch to: `main`
   - Save changes

## Step 5: Update Cloud Build Triggers (if used)

If you have Cloud Build triggers:

```bash
# Update development trigger to use develop branch
gcloud builds triggers update <TRIGGER_NAME> \
    --branch-pattern="^develop$" \
    --project <DEV_PROJECT_ID>

# Create production trigger for main branch
gcloud builds triggers create github \
    --name="deploy-production" \
    --repo-name=<REPO_NAME> \
    --repo-owner=<REPO_OWNER> \
    --branch-pattern="^main$" \
    --build-config=backend/cloudbuild.yaml \
    --project <PRODUCTION_PROJECT_ID>
```

## Step 6: Update Local Development Workflow

After this change, your workflow will be:

### For Development Work

```bash
# Always work on develop branch
git checkout develop
git pull origin develop

# Create feature branches from develop
git checkout -b feature/my-feature develop

# Merge back to develop
git checkout develop
git merge feature/my-feature
git push origin develop
```

### For Production Releases

```bash
# When ready to deploy to production
git checkout main
git pull origin main

# Merge develop into main (or cherry-pick specific commits)
git merge develop
# OR
git cherry-pick <commit-hash>

# Push to main (triggers production deployment)
git push origin main
```

## Step 7: Protect Branches (Recommended)

### Protect Main Branch (Production)

1. Go to GitHub repository → **Settings** → **Branches**
2. Click **Add rule** for `main` branch
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Include administrators
4. Save changes

### Protect Develop Branch (Optional)

1. Add rule for `develop` branch
2. Enable:
   - ✅ Require pull request reviews (optional)
   - ✅ Require status checks to pass
3. Save changes

## Branch Strategy Summary

```
main (Production)
  ↑
  | (merge when ready for production)
  |
develop (Development)
  ↑
  | (merge feature branches)
  |
feature/* (Feature branches)
```

## Verification

After setup, verify:

1. **Branches exist:**
   ```bash
   git branch -a
   # Should show: main, develop, and remotes
   ```

2. **Default branch is main:**
   - Check GitHub repository settings
   - Default branch should be `main`

3. **Netlify deployments:**
   - Development sites deploy from `develop`
   - Production sites deploy from `main`

4. **Cloud Build triggers:**
   - Development triggers use `develop`
   - Production triggers use `main`

## Troubleshooting

### "Cannot delete main branch"

If you can't delete/rename main:
1. First create `develop` branch
2. Push `develop` to remote
3. Change default branch to `develop` on GitHub
4. Then you can rename/delete `main`

### "Remote branch not found"

If remote branches are missing:
```bash
# Fetch all remote branches
git fetch origin

# List all branches
git branch -a
```

### "Netlify still deploying from old branch"

1. Go to Netlify site settings
2. Build & deploy → Branch
3. Manually change to correct branch
4. Trigger a new deploy

## Next Steps

After branch setup:
1. Update production setup scripts (already done)
2. Configure Netlify to use `main` for production
3. Set up branch protection rules
4. Update team workflow documentation
5. Test deployment from `main` branch

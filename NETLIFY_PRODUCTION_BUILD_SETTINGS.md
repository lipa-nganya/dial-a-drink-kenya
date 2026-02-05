# Netlify Production Build Settings

## Production Backend API URL
```
https://dialadrink-backend-prod-805803410802.us-central1.run.app/api
```

---

## 1. Customer Frontend (Customer Site)

### Site Configuration

**Repository**: Your GitHub repository  
**Branch to deploy**: `main`  
**Base directory**: `frontend`

### Build Settings

**Build command:**
```bash
npm install && npm run build
```

**Publish directory:**
```
frontend/build
```

**Node version:**
```
18.0.0
```
(Or latest LTS - Netlify will auto-detect if not specified)

### Environment Variables

Add these in **Site settings → Environment variables**:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api` |
| `REACT_APP_ENVIRONMENT` | `production` |
| `NODE_VERSION` | `18` |
| `CI` | `true` |

### Build Configuration Summary

```
Base directory:        frontend
Build command:         npm install && npm run build
Publish directory:      frontend/build
Node version:           18 (or latest LTS)
```

### Additional Settings

**Redirects**: 
- The `frontend/netlify.toml` file will be automatically used by Netlify
- The build also copies `public/_redirects` to `build/` for client-side routing support
- Both handle SPA routing (redirect all routes to `/index.html`)

**Build timeout**: Default (15 minutes) should be sufficient.

**Note**: Since base directory is `frontend`, Netlify will automatically detect and use `frontend/netlify.toml` if it exists.

---

## 2. Admin Frontend (Admin Dashboard)

### Site Configuration

**Repository**: Your GitHub repository  
**Branch to deploy**: `main`  
**Base directory**: `admin-frontend`

### Build Settings

**Build command:**
```bash
npm install && npm run build
```

**Publish directory:**
```
admin-frontend/build
```

**Node version:**
```
18.0.0
```
(Or latest LTS - Netlify will auto-detect if not specified)

### Environment Variables

Add these in **Site settings → Environment variables**:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api` |
| `REACT_APP_ENVIRONMENT` | `production` |
| `NODE_VERSION` | `18` |
| `CI` | `true` |

### Build Configuration Summary

```
Base directory:        admin-frontend
Build command:          npm install && npm run build
Publish directory:      admin-frontend/build
Node version:           18 (or latest LTS)
```

### Additional Settings

**Redirects & Headers**: 
- The `admin-frontend/netlify.toml` file will be automatically used by Netlify
- Includes redirect rules for client-side routing (all routes → `/index.html`)
- Includes `X-Robots-Tag: noindex, nofollow` header (prevents search engine indexing)
- The build also copies `public/_redirects` to `build/` for additional routing support

**Build timeout**: Default (15 minutes) should be sufficient.

**Note**: Since base directory is `admin-frontend`, Netlify will automatically detect and use `admin-frontend/netlify.toml` if it exists.

---

## Step-by-Step Netlify Setup

### Step 1: Login to Netlify

1. Go to: https://app.netlify.com
2. Click **Sign in**
3. Login with:
   - **Email**: `dialadrinkkenya254@gmail.com`
   - **Password**: `Malibu2026.`

### Step 2: Create Customer Frontend Site

1. Click **Add new site** → **Import an existing project**
2. Click **Deploy with GitHub**
3. Authorize Netlify to access your GitHub repository
4. Select your repository
5. Configure the site:
   - **Branch to deploy**: `main`
   - **Base directory**: `frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `frontend/build`
6. Click **Show advanced** and add environment variables:
   - `REACT_APP_API_URL` = `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api`
   - `REACT_APP_ENVIRONMENT` = `production`
   - `CI` = `true`
7. Click **Deploy site**

### Step 3: Create Admin Frontend Site

1. Click **Add new site** → **Import an existing project**
2. Click **Deploy with GitHub**
3. Select the same repository
4. Configure the site:
   - **Branch to deploy**: `main`
   - **Base directory**: `admin-frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `admin-frontend/build`
5. Click **Show advanced** and add environment variables:
   - `REACT_APP_API_URL` = `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api`
   - `REACT_APP_ENVIRONMENT` = `production`
   - `CI` = `true`
6. Click **Deploy site**

### Step 4: Update Backend CORS

After both sites are deployed, note their Netlify URLs and update the backend CORS:

```bash
# Replace <CUSTOMER_NETLIFY_URL> and <ADMIN_NETLIFY_URL> with actual Netlify URLs
gcloud run services update dialadrink-backend-prod \
  --region us-central1 \
  --project dialadrink-production \
  --update-env-vars FRONTEND_URL=<CUSTOMER_NETLIFY_URL> \
  --update-env-vars ADMIN_URL=<ADMIN_NETLIFY_URL>
```

**Example:**
```bash
gcloud run services update dialadrink-backend-prod \
  --region us-central1 \
  --project dialadrink-production \
  --update-env-vars FRONTEND_URL=https://dialadrink-customer.netlify.app \
  --update-env-vars ADMIN_URL=https://dialadrink-admin.netlify.app
```

---

## Quick Reference: Copy-Paste Settings

### Customer Frontend

```
Base directory:     frontend
Build command:      npm install && npm run build
Publish directory:  frontend/build
```

**Environment Variables:**
```
REACT_APP_API_URL=https://dialadrink-backend-prod-805803410802.us-central1.run.app/api
REACT_APP_ENVIRONMENT=production
CI=true
```

### Admin Frontend

```
Base directory:     admin-frontend
Build command:      npm install && npm run build
Publish directory:  admin-frontend/build
```

**Environment Variables:**
```
REACT_APP_API_URL=https://dialadrink-backend-prod-805803410802.us-central1.run.app/api
REACT_APP_ENVIRONMENT=production
CI=true
```

---

## Troubleshooting

### Build Fails with ESLint Errors

If builds fail due to ESLint warnings (Netlify treats warnings as errors with `CI=true`):

1. Fix the ESLint warnings in your code
2. Or temporarily set `CI=false` (not recommended for production)

### Build Timeout

If builds timeout:
1. Go to **Site settings → Build & deploy → Build settings**
2. Increase **Build timeout** (max 15 minutes for free tier)

### Environment Variables Not Working

1. Ensure variables are set in **Site settings → Environment variables**
2. Redeploy the site after adding variables
3. Variables starting with `REACT_APP_` are automatically injected during build

### Routing Issues (404 on refresh)

Both frontends have `_redirects` files that should be copied automatically. If routing fails:
1. Check that `public/_redirects` exists in the frontend/admin-frontend directory
2. Verify the redirects file is copied to `build/` during build

---

## Verification Checklist

After deployment, verify:

- [ ] Customer site loads at Netlify URL
- [ ] Admin site loads at Netlify URL
- [ ] Both sites can make API calls to backend
- [ ] Client-side routing works (no 404 on refresh)
- [ ] Backend CORS updated with Netlify URLs
- [ ] Environment variables are set correctly

---

## Notes

- Both sites deploy from the same GitHub repository
- Both use the `main` branch for production
- Both use the same backend API URL
- Admin site includes `X-Robots-Tag: noindex, nofollow` header
- Builds are triggered automatically on push to `main` branch

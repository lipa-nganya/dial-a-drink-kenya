# Netlify Domain Setup Guide

This guide explains how the domain setup works for Dial A Drink, with Cloud Run as dev and Netlify as production.

## Domain Structure

### Customer Frontend
- **Dev (Cloud Run)**: `https://dialadrink-customer-910510650031.us-central1.run.app`
- **Prod (Netlify)**: `https://dialadrink.thewolfgang.tech`

### Admin Frontend
- **Dev (Cloud Run)**: `https://dialadrink-admin-910510650031.us-central1.run.app`
- **Prod (Netlify)**: `https://dialadrink-admin.thewolfgang.tech`

### Backend
- **Backend URL**: `https://dialadrink-backend-910510650031.us-central1.run.app`
- Serves both Cloud Run dev deployments and Netlify production deployments

## Architecture

The setup follows a pattern where:
1. **Cloud Run** hosts the development/staging versions of both frontends
2. **Netlify** hosts the production versions with custom domains
3. **Backend** is configured to accept requests from both environments

## Configuration Details

### Backend CORS Configuration

The backend (`backend/app.js`) is configured to allow requests from:
- All Cloud Run dev URLs (run.app)
- All Netlify production domains (thewolfgang.tech)
- Local development (localhost)

The CORS configuration uses:
- Explicit domain allowlist for known URLs
- Regex pattern matching for `*.thewolfgang.tech` subdomains
- Automatic localhost detection

### Frontend API Configuration

Both frontends (`frontend/src/services/api.js` and `admin-frontend/src/services/api.js`) automatically detect the hostname and route API calls accordingly:

1. **Local Development**: Uses `http://localhost:5001/api`
2. **Cloud Run Dev**: Uses production backend URL
3. **Netlify Prod**: Uses production backend URL

The API service prioritizes:
1. Environment variable `REACT_APP_API_URL` (if explicitly set)
2. Hostname-based detection (automatic)
3. Fallback to production backend URL

## Netlify Setup Steps

### 1. Deploy Customer Frontend to Netlify

1. **Connect Repository**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Select the repository

2. **Build Settings**
   - **Base directory**: `frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `frontend/build`

3. **Environment Variables**
   - No environment variables needed! The app automatically detects Netlify domains and uses the production backend.

4. **Custom Domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter: `dialadrink.thewolfgang.tech`
   - Follow Netlify's DNS configuration instructions
   - Update your DNS provider with the CNAME record Netlify provides

### 2. Deploy Admin Frontend to Netlify

1. **Connect Repository**
   - Create a new site in Netlify
   - Connect the same GitHub repository

2. **Build Settings**
   - **Base directory**: `admin-frontend`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `admin-frontend/build`

3. **Environment Variables**
   - No environment variables needed! The app automatically detects Netlify domains.

4. **Custom Domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter: `dialadrink-admin.thewolfgang.tech`
   - Follow Netlify's DNS configuration instructions
   - Update your DNS provider with the CNAME record Netlify provides

### 3. DNS Configuration

In your DNS provider (where `thewolfgang.tech` is registered), add:

```
Type: CNAME
Name: dialadrink
Value: [Netlify-provided CNAME target]
TTL: 3600

Type: CNAME
Name: dialadrink-admin
Value: [Netlify-provided CNAME target]
TTL: 3600
```

**Note**: Netlify will provide the exact CNAME target values when you add the custom domains.

## How It Works

### Automatic API Detection

The frontend applications automatically detect which environment they're running in:

```javascript
// Example from frontend/src/services/api.js
const hostname = window.location.hostname;

if (hostname.includes('thewolfgang.tech')) {
  // Netlify production - use production backend
  return 'https://dialadrink-backend-910510650031.us-central1.run.app/api';
} else if (hostname.includes('run.app')) {
  // Cloud Run dev - use production backend
  return 'https://dialadrink-backend-910510650031.us-central1.run.app/api';
} else {
  // Local development - use localhost
  return 'http://localhost:5001/api';
}
```

### Backend CORS Handling

The backend automatically allows requests from:
- All `*.thewolfgang.tech` subdomains (via regex)
- All Cloud Run URLs
- Localhost for development

No manual CORS configuration needed per deployment!

## Testing

### Test Customer Frontend
1. **Dev**: Visit `https://dialadrink-customer-910510650031.us-central1.run.app`
2. **Prod**: Visit `https://dialadrink.thewolfgang.tech`

Both should work and connect to the same backend.

### Test Admin Frontend
1. **Dev**: Visit `https://dialadrink-admin-910510650031.us-central1.run.app`
2. **Prod**: Visit `https://dialadrink-admin.thewolfgang.tech`

Both should work and connect to the same backend.

### Verify API Connection
Open browser console on any frontend deployment. You should see:
```
=== API CONFIGURATION ===
API_BASE_URL: https://dialadrink-backend-910510650031.us-central1.run.app/api
API source: netlify-prod (or cloud-run-dev)
```

## Troubleshooting

### CORS Errors
- Verify the domain is in the backend's `allowedOrigins` list
- Check browser console for the exact origin being blocked
- Ensure DNS has propagated (can take up to 48 hours)

### API Connection Issues
- Check browser console for API configuration logs
- Verify backend is running: `https://dialadrink-backend-910510650031.us-central1.run.app/api/health`
- Ensure `REACT_APP_API_URL` is not set incorrectly in Netlify environment variables

### Build Failures
- Ensure `package.json` has correct build scripts
- Check that `public/netlify.toml` and `public/_redirects` are in the build output
- Verify Node version in Netlify (should be 18+)

## Environment Variables Summary

### Backend (Cloud Run)
```
NODE_ENV=production
DATABASE_URL=[your-database-url]
FRONTEND_URL=https://dialadrink-customer-910510650031.us-central1.run.app
ADMIN_URL=https://dialadrink-admin-910510650031.us-central1.run.app
```

**Note**: Backend CORS is configured to automatically allow Netlify domains, so no additional environment variables needed.

### Frontend (Netlify)
**No environment variables needed!** The apps automatically detect the hostname and use the correct backend URL.

### Admin Frontend (Netlify)
**No environment variables needed!** The apps automatically detect the hostname and use the correct backend URL.

## Benefits of This Setup

1. **Automatic Environment Detection**: No manual configuration per deployment
2. **Single Backend**: One backend serves both dev and prod frontends
3. **Flexible DNS**: Easy to add new subdomains without backend changes
4. **Development Friendly**: Local development always uses localhost backend
5. **Production Ready**: Custom domains for professional appearance

## Maintenance

- **Adding New Domains**: Just add them to Netlify and update DNS. Backend CORS will automatically allow them via regex.
- **Backend Updates**: Deploy backend to Cloud Run. Both dev and prod frontends will use the updated backend automatically.
- **Frontend Updates**: 
  - Dev: Deploy to Cloud Run
  - Prod: Push to GitHub, Netlify auto-deploys











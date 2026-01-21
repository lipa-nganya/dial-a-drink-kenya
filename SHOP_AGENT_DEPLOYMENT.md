# Shop Agent Frontend - Deployment Guide

## Prerequisites

✅ All configuration files are in place:
- `netlify.toml` - Netlify configuration
- `Dockerfile` - Cloud Run deployment
- `nginx.conf` - Nginx configuration for Cloud Run
- `cloudbuild.yaml` - Cloud Build configuration

## Deployment Options

### Option 1: Deploy to Netlify (Recommended for Production)

#### Quick Deploy (if site already exists)
```bash
cd /Users/maria/dial-a-drink
./deploy-shop-agent.sh
```

#### First-time Netlify Setup

**Via Netlify Dashboard (Recommended):**
1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **"Deploy with GitHub"**
4. Choose repository: `dial-a-drink-kenya`
5. Configure build settings:
   - **Base directory:** `shop-agent-frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `shop-agent-frontend/build`
6. Add environment variables (if needed):
   - `REACT_APP_API_URL`: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
7. Click **"Deploy site"**

**Via Netlify CLI:**
```bash
cd /Users/maria/dial-a-drink/shop-agent-frontend
netlify login
netlify init
# Follow prompts:
# - Select team
# - Site name: dialadrink-shop-agent
# - Base directory: . (current directory)
# - Build command: npm run build
# - Publish directory: build
netlify deploy --prod
```

**One-time deployment:**
```bash
cd /Users/maria/dial-a-drink/shop-agent-frontend
npm install
npm run build
netlify deploy --prod --dir=build
```

---

### Option 2: Deploy to Google Cloud Run (Dev Environment)

#### Quick Deploy
```bash
cd /Users/maria/dial-a-drink
./deploy-shop-agent-cloud.sh
```

#### Manual Deploy
```bash
cd /Users/maria/dial-a-drink/shop-agent-frontend

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Deploy to Cloud Run
gcloud run deploy deliveryos-shop-agent \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api" \
  --memory 256Mi
```

#### Deploy via Cloud Build (CI/CD)
The `cloudbuild.yaml` file is configured for automatic deployments from GitHub:
1. Push changes to GitHub
2. Cloud Build will automatically:
   - Build the Docker image
   - Push to Container Registry
   - Deploy to Cloud Run service: `deliveryos-shop-agent`

**Trigger Cloud Build manually:**
```bash
cd /Users/maria/dial-a-drink/shop-agent-frontend
gcloud builds submit --config cloudbuild.yaml
```

---

## Service URLs

### Netlify (Production)
- **Site name**: (Will be assigned when creating site)
- **URL format**: `https://[site-name].netlify.app`
- **Custom domain**: (Can be configured after initial deployment)

### Cloud Run (Dev)
- **Service name**: `deliveryos-shop-agent`
- **Project**: `drink-suite`
- **Region**: `us-central1`
- **URL format**: `https://deliveryos-shop-agent-[hash]-uc.a.run.app`

To get the Cloud Run URL:
```bash
gcloud run services describe deliveryos-shop-agent \
  --project drink-suite \
  --region us-central1 \
  --format="value(status.url)"
```

---

## Configuration Details

### Environment Variables

Both deployments use the same backend API URL:
```
REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api
```

### Build Configuration

- **Build command**: `npm install && npm run build`
- **Output directory**: `build`
- **Node version**: 18 (specified in Dockerfile)

### Nginx Configuration (Cloud Run)

The Cloud Run deployment uses Nginx to serve the React app:
- **Port**: 8080 (Cloud Run default)
- **SPA routing**: All routes redirect to `index.html`
- **Caching**: Static assets cached for performance

---

## Post-Deployment

### Verify Deployment

**Netlify:**
```bash
curl https://[your-netlify-site].netlify.app
```

**Cloud Run:**
```bash
curl https://[your-cloud-run-url]
```

### Configure Custom Domain (Netlify)

After initial deployment:
1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter your domain (e.g., `shop-agent.thewolfgang.tech`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (5-10 minutes)

---

## Troubleshooting

### Build Fails on Netlify
- Check `package.json` dependencies
- Verify build command: `npm run build`
- Check build logs in Netlify dashboard

### Cloud Run Deployment Fails
- Verify `gcloud` is authenticated: `gcloud auth login`
- Check project is set: `gcloud config set project drink-suite`
- Verify Dockerfile is in the root of `shop-agent-frontend/`

### API Connection Issues
- Verify `REACT_APP_API_URL` environment variable is set correctly
- Check backend CORS configuration allows your frontend URL
- Test backend health: `curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health`

---

## Quick Reference

```bash
# Netlify Deployment
cd /Users/maria/dial-a-drink
./deploy-shop-agent.sh

# Cloud Run Deployment  
cd /Users/maria/dial-a-drink
./deploy-shop-agent-cloud.sh

# Check deployment status
gcloud run services list --project drink-suite --region us-central1
```

# Shop Agent Frontend - Netlify Deployment Guide

## ✅ Completed Steps

1. ✅ Shop agent frontend committed to GitHub
2. ✅ Netlify configuration file (`netlify.toml`) created
3. ✅ Deployment script (`deploy-shop-agent.sh`) created

## 📋 Next Steps: Create Netlify Site

### Option 1: Via Netlify Dashboard (Recommended)

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

### Option 2: Via Netlify CLI (Interactive)

```bash
cd shop-agent-frontend
netlify login
netlify init
# Follow prompts:
# - Select team
# - Site name: dialadrink-stock
# - Base directory: . (current directory)
# - Build command: npm run build
# - Publish directory: build
netlify deploy --prod
```

### Option 3: One-time deployment via CLI

```bash
cd shop-agent-frontend
npm install
npm run build
netlify deploy --prod --dir=build --site=dialadrink-stock
```

## 🌐 Configure Custom Domain

After the site is created:

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `shop-agent-thewolfgang.tech`
4. Follow DNS configuration instructions:
   - Add CNAME record pointing to the Netlify site
   - Or configure DNS via your DNS provider (thewolfgang.tech)
5. Wait for DNS propagation (usually 5-10 minutes)
6. Netlify will automatically provision SSL certificate for the custom domain

## 📁 Repository Structure

```
shop-agent-frontend/
├── public/
│   ├── netlify.toml    # Netlify redirects configuration
│   └── index.html
├── src/
│   └── ...
└── package.json
```

## 🔗 API Configuration

The shop agent frontend is configured to use:
- **Local:** `http://localhost:5001/api`
- **Production:** `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`

This is set in `shop-agent-frontend/src/services/api.js` and automatically detects the environment.

## 📝 Notes

- The `netlify.toml` file includes SPA routing redirects (`/* -> /index.html`)
- Build output directory: `shop-agent-frontend/build`
- The deployment script `deploy-shop-agent.sh` can be used for manual deployments

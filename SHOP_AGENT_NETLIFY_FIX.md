# Shop Agent Frontend - Netlify Deployment Fix

## ✅ Fixed Configuration

1. ✅ Created `shop-agent-frontend/netlify.toml` in root directory (not just public/)
2. ✅ Added `postbuild` script to copy netlify.toml to build directory
3. ✅ Configuration matches admin-frontend pattern

## 🔧 Build Configuration (for Netlify Dashboard)

When setting up in Netlify Dashboard, use these **exact** settings:

### Build Settings:
- **Base directory:** `shop-agent-frontend`
- **Build command:** `npm install && npm run build`
- **Publish directory:** `shop-agent-frontend/build`

### Important Notes:
- The `netlify.toml` file is in `shop-agent-frontend/` (root of the frontend directory)
- This is different from having it just in `public/`
- The `postbuild` script ensures `netlify.toml` is copied to `build/` directory

## 🐛 Common Deployment Issues

### Issue 1: "Base directory not found"
**Solution:** Make sure Base directory is `shop-agent-frontend` (not `./shop-agent-frontend` or `/shop-agent-frontend`)

### Issue 2: "Build command failed"
**Solution:** 
- Check that Node version in Netlify matches local (check `.nvmrc` or `package.json` engines)
- Ensure `npm install` has network access
- Check build logs for specific npm errors

### Issue 3: "Publish directory not found"
**Solution:** 
- Publish directory must be `shop-agent-frontend/build`
- Make sure the build completed successfully
- Check that `build/` directory exists after build

### Issue 4: "Site not found" when deploying via CLI
**Solution:** 
- Create site first via Netlify Dashboard
- Then link locally with: `netlify link --name dialadrink-stock`
- Or use: `netlify init` and follow prompts

## 📋 Manual Site Creation Steps

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select "Deploy with GitHub"
4. Choose repository: `dial-a-drink-kenya`
5. **Configure build settings:**
   - Base directory: `shop-agent-frontend` ⚠️ **MUST MATCH EXACTLY**
   - Build command: `npm install && npm run build`
   - Publish directory: `shop-agent-frontend/build`
6. Click "Deploy site"
7. After successful deployment, add custom domain: `dialadrink-stock.thewolfgang.tech`

## ✅ Verification

After deployment, verify:
- Site builds successfully (green checkmark)
- Site URL works (can access the app)
- Custom domain is configured (if applicable)
- API calls work (check browser console)

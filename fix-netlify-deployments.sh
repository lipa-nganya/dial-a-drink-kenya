#!/bin/bash
# Fix Netlify deployments for customer and admin sites

echo "🔧 Fixing Netlify deployments..."
echo ""

# Customer site
echo "📦 Configuring customer site (dialadrink-customer)..."
netlify api updateSite --data '{
  "site_id": "c3dc4179-bbfc-472f-9c77-0996792fc234",
  "build_settings": {
    "cmd": "npm install && npm run build",
    "dir": "frontend",
    "base": "frontend",
    "publish": "frontend/build"
  }
}' > /dev/null 2>&1

# Admin site  
echo "📦 Configuring admin site (dialadrink-admin)..."
netlify api updateSite --data '{
  "site_id": "49594eef-c511-4278-85a3-f8c37d084053",
  "build_settings": {
    "cmd": "npm install && npm run build",
    "dir": "admin-frontend",
    "base": "admin-frontend",
    "publish": "admin-frontend/build"
  }
}' > /dev/null 2>&1

echo ""
echo "✅ Build settings updated!"
echo ""
echo "⚠️  IMPORTANT: You need to connect the GitHub repository manually:"
echo ""
echo "For Customer Site:"
echo "1. Go to: https://app.netlify.com/projects/dialadrink-customer/configuration/deploys"
echo "2. Click 'Link to Git provider' or 'Connect to Git'"
echo "3. Select: lipa-nganya/dial-a-drink-kenya"
echo "4. Set Base directory: frontend"
echo "5. Set Build command: npm install && npm run build"
echo "6. Set Publish directory: frontend/build"
echo ""
echo "For Admin Site:"
echo "1. Go to: https://app.netlify.com/projects/dialadrink-admin/configuration/deploys"
echo "2. Click 'Link to Git provider' or 'Connect to Git'"
echo "3. Select: lipa-nganya/dial-a-drink-kenya"
echo "4. Set Base directory: admin-frontend"
echo "5. Set Build command: npm install && npm run build"
echo "6. Set Publish directory: admin-frontend/build"
echo ""

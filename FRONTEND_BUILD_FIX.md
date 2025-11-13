# 🔧 Frontend Build Fix for Render

## 🚨 Issue: "Could not find a required file. Name: index.html"

This error occurs when React can't find the `index.html` file in the expected location during the build process.

## 🔧 Solutions to Try:

### **Solution 1: Manual Deployment (Recommended)**

Instead of using `render.yaml`, deploy manually:

1. **Go to Render Dashboard**
2. **Create Static Site**
3. **Settings:**
   - **Name**: `dialadrink-frontend`
   - **Environment**: Static
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `build`
   - **Environment Variables**:
     - `REACT_APP_API_URL`: `https://your-backend-url.onrender.com/api`

### **Solution 2: Alternative Build Commands**

Try these build commands in Render:

#### **Option A: Clean Install**
```
cd frontend && npm ci && npm run build
```

#### **Option B: Force Rebuild**
```
cd frontend && rm -rf node_modules package-lock.json && npm install && npm run build
```

#### **Option C: With Cache Clear**
```
cd frontend && npm install --no-cache && npm run build
```

### **Solution 3: Check File Structure**

Ensure your project structure is:
```
dial-a-drink-kenya/
├── frontend/
│   ├── public/
│   │   ├── index.html ✅
│   │   ├── favicon.ico
│   │   └── ...
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/
└── render.yaml
```

### **Solution 4: Verify index.html**

Make sure `frontend/public/index.html` exists and contains:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

## 🚀 Step-by-Step Manual Deployment:

### **1. Delete Existing Frontend Service**
- Go to your Render dashboard
- Delete the existing frontend service if it exists

### **2. Create New Static Site**
- Click "New +" → "Static Site"
- **Connect Repository**: `https://github.com/lipa-nganya/dial-a-drink-kenya`
- **Name**: `dialadrink-frontend`
- **Environment**: Static
- **Root Directory**: `frontend`
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `build`

### **3. Set Environment Variables**
- `REACT_APP_API_URL`: `https://your-backend-url.onrender.com/api`

### **4. Deploy**
- Click "Create Static Site"
- Wait for deployment

## 🔍 Debugging Steps:

### **1. Check Build Logs**
Look for these in the Render logs:
- ✅ "Installing dependencies"
- ✅ "Running build command"
- ❌ "Could not find a required file"

### **2. Verify Working Directory**
The build should run from `/opt/render/project/src/frontend/`

### **3. Check File Permissions**
Ensure all files are readable by the build process

## 🎯 Expected Results:

After successful deployment:
- **Frontend URL**: `https://drink-suite-customer-910510650031.us-central1.run.app`
- **Should show**: Dial A Drink Kenya homepage
- **Admin Dashboard**: `https://drink-suite-customer-910510650031.us-central1.run.app/admin`

## 🆘 If Still Failing:

### **Try Different Node Version**
Add to `frontend/package.json`:
```json
{
  "engines": {
    "node": "18.x"
  }
}
```

### **Check for Hidden Files**
Make sure there are no hidden files causing issues:
```bash
ls -la frontend/public/
```

### **Verify React Scripts**
Ensure `react-scripts` is properly installed:
```bash
cd frontend && npm list react-scripts
```

---

**The frontend should build successfully with these fixes! 🍹✨**

# 🚀 Manual Render Deployment Guide

Since the `render.yaml` might be causing conflicts, here's how to deploy manually:

## 📋 Step-by-Step Manual Deployment

### 1. Create PostgreSQL Database

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Click "New +" → "PostgreSQL"

2. **Database Settings**
   - **Name**: `dialadrink-db`
   - **Database**: `dialadrink`
   - **User**: `dialadrink_user`
   - **Region**: Oregon (US West)
   - **Plan**: Starter (Free)
   - Click "Create Database"

3. **Copy Database URL**
   - Copy the **External Database URL**
   - Format: `postgresql://user:password@host:port/database`

### 2. Deploy Backend (Manual)

1. **Create Web Service**
   - Click "New +" → "Web Service"
   - **Connect Repository**: `https://github.com/lipa-nganya/dial-a-drink-kenya`
   - **Name**: `dialadrink-backend`
   - **Environment**: Node
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

2. **Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=[Your PostgreSQL External Database URL]
   ```

3. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment
   - Note the URL: `https://dialadrink-backend-910510650031.us-central1.run.app`

### 3. Deploy Frontend (Manual)

1. **Create Static Site**
   - Click "New +" → "Static Site"
   - **Connect Repository**: `https://github.com/lipa-nganya/dial-a-drink-kenya`
   - **Name**: `dialadrink-frontend`
   - **Environment**: Static
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

2. **Environment Variables**
   ```
   REACT_APP_API_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api
   ```

3. **Deploy**
   - Click "Create Static Site"
   - Wait for deployment
   - Note the URL: `https://drink-suite-customer-910510650031.us-central1.run.app`

### 4. Update Backend CORS

After both are deployed:

1. **Go to Backend Service**
2. **Environment Variables**
3. **Add**:
   ```
   FRONTEND_URL=https://drink-suite-customer-910510650031.us-central1.run.app
   ```
4. **Redeploy** the backend

## 🔧 Troubleshooting

### If Frontend Build Still Fails:

1. **Check Build Logs** in Render dashboard
2. **Try Different Build Command**:
   ```
   cd frontend && npm ci && npm run build
   ```
3. **Verify Node Version** - Render should use Node 18+
4. **Check for Missing Dependencies** in package.json

### If Backend Fails:

1. **Check Database Connection** - Verify DATABASE_URL
2. **Check Build Logs** for specific errors
3. **Verify Environment Variables** are set correctly

## 🧪 Test Your Deployment

### Backend Health Check
- Visit: `https://dialadrink-backend-910510650031.us-central1.run.app/api/health`
- Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

### Frontend
- Visit: `https://drink-suite-customer-910510650031.us-central1.run.app`
- Should show the homepage

### Admin Dashboard
- Visit: `https://drink-suite-customer-910510650031.us-central1.run.app/admin`
- Should show the admin dashboard

## 🎉 Success!

Your Dial A Drink Kenya app should now be live!

- **Frontend**: `https://drink-suite-customer-910510650031.us-central1.run.app`
- **Backend**: `https://dialadrink-backend-910510650031.us-central1.run.app`
- **Admin**: `https://drink-suite-customer-910510650031.us-central1.run.app/admin`

---

**Ready to serve drinks across Kenya! 🇰🇪🍹**

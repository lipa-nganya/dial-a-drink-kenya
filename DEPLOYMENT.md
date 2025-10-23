# 🚀 Render Deployment Guide

This guide will help you deploy the Dial A Drink Kenya application to Render.com.

## 📋 Prerequisites

- GitHub repository: https://github.com/lipa-nganya/dial-a-drink-kenya
- Render.com account
- Basic understanding of environment variables

## 🗄️ Step 1: Create PostgreSQL Database

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Sign in to your account

2. **Create New PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - **Name**: `dialadrink-db`
   - **Database**: `dialadrink`
   - **User**: `dialadrink_user`
   - **Region**: Oregon (US West)
   - **Plan**: Starter (Free tier)
   - Click "Create Database"

3. **Note the Connection Details**
   - Copy the **External Database URL** (you'll need this for the backend)

## 🔧 Step 2: Deploy Backend API

1. **Create New Web Service**
   - Click "New +" → "Web Service"
   - **Connect Repository**: Select your GitHub repo
   - **Name**: `dialadrink-backend`
   - **Environment**: Node
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

2. **Environment Variables**
   - **NODE_ENV**: `production`
   - **DATABASE_URL**: `[Your PostgreSQL External Database URL]`
   - **PORT**: `10000` (Render will override this)

3. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the **URL** (e.g., `https://dialadrink-backend.onrender.com`)

## 🎨 Step 3: Deploy Frontend

1. **Create New Static Site**
   - Click "New +" → "Static Site"
   - **Connect Repository**: Select your GitHub repo
   - **Name**: `dialadrink-frontend`
   - **Environment**: Static
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

2. **Environment Variables**
   - **REACT_APP_API_URL**: `https://dialadrink-backend.onrender.com/api`

3. **Deploy**
   - Click "Create Static Site"
   - Wait for deployment to complete
   - Note the **URL** (e.g., `https://dialadrink-frontend.onrender.com`)

## 🔗 Step 4: Update Backend CORS

After both services are deployed, update the backend CORS settings:

1. **Go to Backend Service Settings**
2. **Environment Variables**
3. **Add/Update**:
   - **FRONTEND_URL**: `https://dialadrink-frontend.onrender.com`

4. **Update backend/app.js** to use this environment variable:
   ```javascript
   app.use(cors({
     origin: process.env.FRONTEND_URL || "http://localhost:3001"
   }));
   ```

## 🧪 Step 5: Test Deployment

### Test Backend
- Visit: `https://dialadrink-backend.onrender.com/api/health`
- Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

### Test Frontend
- Visit: `https://dialadrink-frontend.onrender.com`
- Should show the Dial A Drink Kenya homepage

### Test Admin Dashboard
- Visit: `https://dialadrink-frontend.onrender.com/admin`
- Should show the admin dashboard

## 🔧 Environment Variables Summary

### Backend Environment Variables
```
NODE_ENV=production
DATABASE_URL=[PostgreSQL External Database URL]
FRONTEND_URL=https://dialadrink-frontend.onrender.com
```

### Frontend Environment Variables
```
REACT_APP_API_URL=https://dialadrink-backend.onrender.com/api
```

## 📊 Database Setup

The database will be automatically set up when the backend first runs:
- Tables will be created automatically
- Sample data will be seeded
- No manual database setup required

## 🚨 Troubleshooting

### Common Issues

1. **Backend Won't Start**
   - Check DATABASE_URL is correct
   - Ensure PostgreSQL database is running
   - Check build logs for errors

2. **Frontend Can't Connect to Backend**
   - Verify REACT_APP_API_URL is correct
   - Check CORS settings in backend
   - Ensure backend is deployed and running

3. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check PostgreSQL database is accessible
   - Ensure SSL is enabled

### Logs and Debugging

- **Backend Logs**: Go to backend service → "Logs" tab
- **Frontend Logs**: Go to frontend service → "Logs" tab
- **Database Logs**: Go to database service → "Logs" tab

## 🔄 Updates and Maintenance

### Updating the Application
1. Push changes to GitHub
2. Render will automatically redeploy
3. Check logs for any issues

### Scaling
- **Free Tier**: 750 hours/month, sleeps after 15 minutes of inactivity
- **Paid Plans**: Always-on services, better performance
- **Database**: Can upgrade to paid plans for better performance

## 📱 Mobile Testing

Test the mobile responsiveness:
1. Open the frontend URL on your phone
2. Test the admin dashboard on mobile
3. Verify all features work on different screen sizes

## 🎉 Success!

Your Dial A Drink Kenya application is now live on Render!

- **Frontend**: `https://dialadrink-frontend.onrender.com`
- **Backend API**: `https://dialadrink-backend.onrender.com`
- **Admin Dashboard**: `https://dialadrink-frontend.onrender.com/admin`

## 📞 Support

If you encounter any issues:
1. Check the Render documentation
2. Review the application logs
3. Verify environment variables
4. Test locally first to isolate issues

---

**Ready to serve drinks across Kenya! 🇰🇪🍹**

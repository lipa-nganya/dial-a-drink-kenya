# 🗄️ Database Setup Guide

## 🚨 Current Issue: Local Database Connection

You're getting `[Errno 8] nodename nor servname provided, or not known` because you're trying to connect to a local database that doesn't exist.

## 🔧 Solutions:

### **Option 1: Use Render PostgreSQL (Recommended for Production)**

#### **1. Create PostgreSQL Database on Render**
1. Go to [render.com](https://render.com)
2. Click "New +" → "PostgreSQL"
3. **Settings:**
   - **Name**: `dialadrink-db`
   - **Database**: `dialadrink`
   - **User**: `dialadrink_user`
   - **Region**: Oregon (US West)
   - **Plan**: Starter (Free)
4. Click "Create Database"
5. **Copy the External Database URL** (looks like: `postgresql://user:password@host:port/database`)

#### **2. Update Backend Environment Variables**
In your Render backend service:
- **Environment Variables**:
  - `DATABASE_URL`: `[Your PostgreSQL External Database URL]`
  - `NODE_ENV`: `production`

#### **3. Test Database Connection**
Your backend will automatically:
- ✅ Connect to the Render PostgreSQL database
- ✅ Create tables if they don't exist
- ✅ Seed the database with sample data

### **Option 2: Local Development Database**

If you want to run locally for development:

#### **1. Install PostgreSQL Locally**
```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb dialadrink
```

#### **2. Update Local Configuration**
In `backend/config.js`, your local settings should be:
```javascript
development: {
  username: 'your_username',
  password: 'your_password',
  database: 'dialadrink',
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
}
```

#### **3. Connect with pgAdmin**
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `dialadrink`
- **Username**: `your_username`
- **Password**: `your_password`

## 🎯 Recommended Approach:

### **For Production (Render Deployment):**
1. ✅ **Use Render PostgreSQL** (already configured)
2. ✅ **Backend connects automatically**
3. ✅ **Database is managed by Render**
4. ✅ **No local setup needed**

### **For Local Development:**
1. **Install PostgreSQL locally**
2. **Update backend config**
3. **Connect with pgAdmin**

## 🔍 Current Status:

Your application is configured to use:
- ✅ **Render PostgreSQL** for production
- ✅ **Automatic database setup**
- ✅ **Sample data seeding**

## 📋 Next Steps:

1. **Deploy to Render** (database will be created automatically)
2. **Test the deployed application**
3. **Use Render's database management** instead of local pgAdmin

## 🚀 Quick Test:

Once deployed, test your database by:
1. **Visit your backend URL**: `https://dialadrink-backend-910510650031.us-central1.run.app/api/health`
2. **Check categories**: `https://dialadrink-backend-910510650031.us-central1.run.app/api/categories`
3. **Should return data** if database is working

---

**The Render PostgreSQL database will be automatically set up when you deploy! 🍹✨**

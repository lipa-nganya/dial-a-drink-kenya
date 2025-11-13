# Finding Cloud Database Password

## Where to Find It

The cloud database password is stored in **Render Dashboard** as part of the `DATABASE_URL` connection string.

## Steps to Get Database Password

### Option 1: From Render Dashboard (Easiest)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign in to your account

2. **Find Your Database**
   - Look for database named: `dial-a-drink-db` or `dialadrink-db`
   - Click on it

3. **Get Connection String**
   - Scroll to **"Connections"** section
   - Copy the **"External Database URL"**
   - Format: `postgresql://user:password@host:port/database`

4. **Extract Password**
   - The password is between `:` and `@` in the connection string
   - Example: `postgresql://user:YOUR_PASSWORD_HERE@host:port/database`

### Option 2: From Backend Service Environment Variables

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com

2. **Find Your Backend Service**
   - Look for: `dialadrink-backend` or `dial-a-drink-backend`
   - Click on it

3. **Check Environment Variables**
   - Go to **"Environment"** tab
   - Look for `DATABASE_URL`
   - Copy the value
   - Extract password from the connection string

### Option 3: Reset Password (If Needed)

If you need to reset the password:

1. **Go to Database Settings**
   - Render Dashboard → Your Database → Settings

2. **Reset Password**
   - Click **"Reset Password"** or **"Change Password"**
   - Generate a new password
   - **Important**: Update `DATABASE_URL` in backend service environment variables

## Current Database Configuration

Based on your `render.yaml`:

- **Database Name**: `dial-a-drink-db`
- **Service**: Backend pulls `DATABASE_URL` from database connection string
- **Location**: Render Dashboard → Database → Connection String

## Security Note

⚠️ **Never commit passwords to git!**

The password should only be:
- ✅ Stored in Render Dashboard (environment variables)
- ✅ Stored in local `.env` file (gitignored)
- ❌ Never in code files
- ❌ Never in git repository

## Quick Access

**Render Dashboard**: https://dashboard.render.com

Look for:
- Database: `dial-a-drink-db` or `dialadrink-db`
- Backend Service: `dialadrink-backend` or `dial-a-drink-backend`


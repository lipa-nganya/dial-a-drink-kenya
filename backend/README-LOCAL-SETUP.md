# Local Development Setup

This guide ensures your local environment is properly configured and won't break when deploying to production.

## Environment Configuration

### 1. Create `.env.local` file

Create a `backend/.env.local` file (this file is gitignored and won't be committed):

```bash
cd backend
cp .env.local.example .env.local
```

### 2. Set `NODE_ENV=development`

**CRITICAL**: Your `.env.local` file MUST have:

```env
NODE_ENV=development
```

This ensures:
- Local uses the `development` database config (local PostgreSQL)
- Local does NOT use production Cloud SQL database
- Local environment is properly detected

### 3. Local Database Configuration

In `.env.local`, configure your local PostgreSQL:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dialadrink
DB_USER=postgres
DB_PASSWORD=your_local_password
```

**DO NOT** set `DATABASE_URL` in `.env.local` - it will override the local database config.

### 4. M-Pesa Configuration

M-Pesa settings can be inherited from `.env` or set in `.env.local`:

```env
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok-free.dev/api/mpesa/callback
```

## How It Works

1. **Environment Detection**: The app uses `utils/envDetection.js` to detect if running locally or in production
2. **Config Priority**: `.env.local` is loaded first, then `.env` (local overrides shared)
3. **Database Config**: When `NODE_ENV=development`, always uses `development` config (local DB)
4. **Production Safety**: Even if `DATABASE_URL` is set, local won't use it when `NODE_ENV=development`

## Troubleshooting

### Local is using production database

**Problem**: Local connects to production Cloud SQL instead of local database

**Solution**:
1. Check `.env.local` has `NODE_ENV=development`
2. Remove `DATABASE_URL` from `.env.local` if it exists
3. Restart the backend server

### Local breaks after deploying to dev

**Problem**: After deploying, local stops working

**Solution**:
1. Ensure `.env.local` exists with `NODE_ENV=development`
2. Check that `.env.local` is not being committed to git
3. Restart local backend server

### Environment detection logs

When starting the backend, you should see:

```
🔍 Environment detection: NODE_ENV=development, Using config: development, isLocal: true, isProduction: false
```

If you see `isLocal: false` or `Using config: cloud-dev`, check your `.env.local` file.

## Best Practices

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Always set `NODE_ENV=development`** in `.env.local`
3. **Use local database** - Don't use production database for local development
4. **Keep `.env` for shared config** - M-Pesa credentials, API keys, etc.
5. **Use `.env.local` for local overrides** - Database config, local URLs, etc.

## Quick Start

```bash
# 1. Create .env.local
cd backend
echo "NODE_ENV=development" > .env.local
echo "DB_HOST=localhost" >> .env.local
echo "DB_PORT=5432" >> .env.local
echo "DB_NAME=dialadrink" >> .env.local
echo "DB_USER=postgres" >> .env.local
echo "DB_PASSWORD=password" >> .env.local

# 2. Start backend
npm start

# 3. Verify environment detection
# Check logs for: "Using config: development, isLocal: true"
```




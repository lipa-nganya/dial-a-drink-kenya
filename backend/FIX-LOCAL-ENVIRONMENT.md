# Fix: Local Environment Breaking After Deployments

## Problem

Local development was breaking every time changes were deployed to dev/production. The root cause was:

1. **No explicit `NODE_ENV=development`** - Local didn't explicitly set development mode
2. **Environment detection issues** - Code couldn't reliably detect local vs production
3. **Database config confusion** - Local might accidentally use production database if `DATABASE_URL` was set
4. **No local environment overrides** - No way to override shared `.env` for local development

## Solution Implemented

### 1. Created Environment Detection Utility (`utils/envDetection.js`)

A centralized utility that properly detects:
- Local development (`NODE_ENV=development` or not in Cloud Run)
- Production (Cloud Run, Render, or `NODE_ENV=production`)
- Database config selection (development vs cloud-dev vs production)

### 2. Created `.env.local` Support

- `.env.local` is loaded first, then `.env` (local overrides shared)
- `.env.local` is gitignored (won't be committed)
- Ensures local always uses development config when `NODE_ENV=development` is set

### 3. Updated Database Configuration Logic

- When `NODE_ENV=development`, **always** uses `development` config (local DB)
- Even if `DATABASE_URL` is set, local won't use it when in development mode
- Prevents accidental production database usage

### 4. Updated M-Pesa Service

- Uses environment detection utility instead of manual checks
- Properly detects local vs production for callback URLs
- Consistent environment detection across the codebase

## Files Changed

1. **`backend/utils/envDetection.js`** (NEW)
   - Centralized environment detection
   - Functions: `isLocal()`, `isProduction()`, `getDatabaseConfigName()`

2. **`backend/models/index.js`**
   - Uses `getDatabaseConfigName()` instead of `process.env.NODE_ENV`
   - Added warning logs when `DATABASE_URL` is set in local environment

3. **`backend/services/mpesa.js`**
   - Uses `isProduction()` from environment detection utility
   - Consistent callback URL detection

4. **`backend/routes/mpesa.js`**
   - Uses `isProduction()` from environment detection utility
   - Removed duplicate environment detection code

5. **`backend/server.js`**
   - Loads `.env.local` first, then `.env`
   - Ensures local overrides are applied

6. **`backend/.env.local`** (NEW - gitignored)
   - Contains `NODE_ENV=development`
   - Local database configuration
   - Prevents production database usage

7. **`backend/.env.local.example`** (NEW)
   - Template for local environment setup
   - Documents required settings

8. **`backend/README-LOCAL-SETUP.md`** (NEW)
   - Complete guide for local development setup
   - Troubleshooting tips

## How to Use

### For Local Development

1. **Create `.env.local`** (if not exists):
   ```bash
   cd backend
   cp .env.local.example .env.local
   ```

2. **Ensure `NODE_ENV=development`** is set in `.env.local`

3. **Configure local database** in `.env.local`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=dialadrink
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

4. **Start backend**:
   ```bash
   npm start
   ```

5. **Verify environment detection** in logs:
   ```
   🔍 Environment detection: NODE_ENV=development, Using config: development, isLocal: true, isProduction: false
   ```

### For Production/Deployment

- Production uses `NODE_ENV=production` (set by Cloud Run)
- Production uses `DATABASE_URL` environment variable
- Environment detection automatically uses correct config

## Benefits

1. **Local won't break after deployments** - `.env.local` is separate from shared `.env`
2. **Explicit environment detection** - Clear separation between local and production
3. **Safety** - Local can't accidentally use production database
4. **Consistency** - All code uses the same environment detection utility
5. **Documentation** - Clear setup guide and troubleshooting

## Verification

Test that local environment is working:

```bash
cd backend
node -e "require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); const { getDatabaseConfigName, isLocal } = require('./utils/envDetection'); console.log('Config:', getDatabaseConfigName(), 'isLocal:', isLocal());"
```

Should output:
```
Config: development isLocal: true
```

## Future Deployments

When deploying to production:
1. Local `.env.local` is not affected (it's gitignored)
2. Production uses `NODE_ENV=production` (set by Cloud Run)
3. Environment detection automatically uses correct config
4. **Local will continue working** after deployments

## Troubleshooting

If local breaks after deployment:

1. Check `.env.local` exists and has `NODE_ENV=development`
2. Restart local backend server
3. Check logs for environment detection output
4. Verify local database is running and accessible

See `README-LOCAL-SETUP.md` for detailed troubleshooting guide.




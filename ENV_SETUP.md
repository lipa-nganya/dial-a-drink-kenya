# Environment Variables Setup Guide

This guide explains how to permanently configure environment variables for the backend in Cloud Run.

## Quick Start

1. **Create `.env` file** in the `backend/` directory:
   ```bash
   cd backend
   touch .env
   ```

2. **Add your environment variables** to `backend/.env`:
   ```env
   # Required
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@host:port/database
   JWT_SECRET=your-super-secret-jwt-key-change-this
   
   # M-Pesa (Required for payments)
   MPESA_CONSUMER_KEY=your_mpesa_consumer_key
   MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
   MPESA_SHORTCODE=your_mpesa_shortcode
   MPESA_PASSKEY=your_mpesa_passkey
   MPESA_CALLBACK_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/callback
   
   # Optional
   ADMIN_TOKEN_TTL=12h
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

3. **Sync to Cloud Run**:
   ```bash
   ./sync-env-to-cloud-run.sh
   ```

That's it! Your environment variables are now permanently set in Cloud Run and will persist across deployments.

## Available Environment Variables

### Required Variables

- `NODE_ENV` - Set to `production` for Cloud Run
- `DATABASE_URL` - PostgreSQL connection string (Cloud SQL format)
- `JWT_SECRET` - Secret key for JWT token signing
- `MPESA_CONSUMER_KEY` - M-Pesa API consumer key
- `MPESA_CONSUMER_SECRET` - M-Pesa API consumer secret
- `MPESA_SHORTCODE` - M-Pesa business shortcode
- `MPESA_PASSKEY` - M-Pesa API passkey

### Optional Variables

#### M-Pesa Configuration
- `MPESA_ENVIRONMENT` - `production` or `sandbox` (default: `production`)
- `MPESA_CALLBACK_URL` - Callback URL for STK push (default: production URL)
- `MPESA_B2C_CALLBACK_URL` - Callback URL for B2C payments
- `MPESA_INITIATOR_NAME` - Initiator name for B2C (default: `testapi`)
- `MPESA_SECURITY_CREDENTIAL` - Security credential for B2C
- `MPESA_B2C_SHORTCODE` - Shortcode for B2C (defaults to MPESA_SHORTCODE)

#### Authentication
- `ADMIN_TOKEN_TTL` - JWT token expiration (default: `12h`)

#### Email/SMTP (for admin invites)
- `SMTP_HOST` - SMTP server hostname (default: `smtp.gmail.com`)
- `SMTP_PORT` - SMTP port (default: `587`)
- `SMTP_SECURE` - Use TLS (default: `false`)
- `SMTP_USER` - SMTP username/email
- `SMTP_PASS` - SMTP password/app password
- `SMTP_FROM` - From email address

#### Frontend URLs
- `FRONTEND_URL` - Customer frontend URL (default: `http://localhost:3000`)
- `ADMIN_URL` - Admin frontend URL (default: `http://localhost:3001`)

#### Development/Testing
- `FORCE_REAL_MPESA` - Force real M-Pesa even in development (default: `false`)
- `NGROK_URL` - ngrok URL for local development
- `DB_REQUIRE_SSL` - Require SSL for database (default: auto-detect)

## How It Works

1. **`.env` file**: Store your environment variables locally in `backend/.env`
2. **`sync-env-to-cloud-run.sh`**: Reads `.env` and syncs all variables to Cloud Run
3. **Persistence**: Variables persist across deployments unless explicitly changed
4. **Deployment**: `deploy-backend.sh` preserves existing env vars when deploying

## Updating Variables

### Update a single variable:
```bash
gcloud run services update dialadrink-backend \
  --region=us-central1 \
  --project=drink-suite \
  --update-env-vars "MPESA_CONSUMER_KEY=new_value"
```

### Update multiple variables:
Edit `backend/.env` and run:
```bash
./sync-env-to-cloud-run.sh
```

### View current variables:
```bash
gcloud run services describe dialadrink-backend \
  --region=us-central1 \
  --project=drink-suite \
  --format="get(spec.template.spec.containers[0].env)"
```

## Security Notes

- ⚠️ **Never commit `.env` to git** - it's in `.gitignore`
- ⚠️ **Keep secrets secure** - use strong, unique values
- ⚠️ **Rotate secrets regularly** - especially JWT_SECRET and M-Pesa credentials
- ⚠️ **Use Cloud Secret Manager** for production (optional upgrade)

## Troubleshooting

### Variables not updating?
- Make sure `.env` file exists in `backend/` directory
- Check that variables are in `KEY=VALUE` format (no spaces around `=`)
- Verify you have Cloud Run admin permissions

### Variables lost after deployment?
- Use `--update-env-vars` instead of `--set-env-vars` (preserves existing)
- Run `sync-env-to-cloud-run.sh` after deployment if needed

### M-Pesa not working?
- Verify all 4 M-Pesa credentials are set
- Check callback URL is whitelisted in M-Pesa dashboard
- Ensure `MPESA_ENVIRONMENT=production` for live payments


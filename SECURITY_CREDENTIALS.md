# Security: API Credentials Management

## ⚠️ IMPORTANT: Never Commit Credentials to Git

This document outlines how to securely manage API credentials and environment variables.

## Credentials That Must Be Protected

1. **M-Pesa Credentials**
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_SHORTCODE`
   - `MPESA_PASSKEY`

2. **PesaPal Credentials**
   - `PESAPAL_CONSUMER_KEY`
   - `PESAPAL_CONSUMER_SECRET`

3. **Google Maps API Key**
   - `GOOGLE_MAPS_API_KEY` (backend)
   - `REACT_APP_GOOGLE_MAPS_API_KEY` (frontend)

4. **Database Credentials**
   - `DATABASE_URL`

5. **JWT Secret**
   - `JWT_SECRET`

## Local Development Setup

### 1. Create `.env` Files (Never Commit These)

Create `.env` files in each directory:

**`backend/.env`**
```bash
GOOGLE_MAPS_API_KEY=your_key_here
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
MPESA_CONSUMER_KEY=your_mpesa_key
MPESA_CONSUMER_SECRET=your_mpesa_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
PESAPAL_CONSUMER_KEY=your_pesapal_key
PESAPAL_CONSUMER_SECRET=your_pesapal_secret
```

**`frontend/.env`**
```bash
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
```

**`admin-frontend/.env`**
```bash
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
```

### 2. Verify .env Files Are Ignored

Run this command to verify `.env` files are ignored:
```bash
git check-ignore -v backend/.env frontend/.env admin-frontend/.env
```

All should show as ignored.

## Deployment

### Development Deployment

Set environment variables before running deployment script:
```bash
export PESAPAL_CONSUMER_KEY="your_sandbox_key"
export PESAPAL_CONSUMER_SECRET="your_sandbox_secret"
export GOOGLE_MAPS_API_KEY="your_key"
./deploy-backend-dev.sh
```

### Production Deployment

Set all production credentials as environment variables:
```bash
export MPESA_CONSUMER_KEY="your_production_key"
export MPESA_CONSUMER_SECRET="your_production_secret"
export MPESA_SHORTCODE="your_shortcode"
export MPESA_PASSKEY="your_passkey"
export PESAPAL_CONSUMER_KEY="your_production_key"
export PESAPAL_CONSUMER_SECRET="your_production_secret"
export GOOGLE_MAPS_API_KEY="your_key"
./deploy-to-production-complete.sh
```

### Cloud Build (Frontend Deployments)

Set substitution variables in Google Cloud Build:
```bash
gcloud builds submit --substitutions=_GOOGLE_MAPS_API_KEY=your_key_here
```

Or configure in Cloud Build triggers:
- Go to Cloud Build > Triggers
- Edit trigger
- Add substitution variable: `_GOOGLE_MAPS_API_KEY` = `your_key_here`

## Android App

The Google Maps API key in `driver-app-native/app/src/main/res/values/strings.xml` is public-facing (used client-side). This is acceptable as Google Maps API keys should be restricted by domain/package in Google Cloud Console.

## Security Checklist

- [ ] All `.env` files are in `.gitignore`
- [ ] No credentials are hardcoded in source files
- [ ] Deployment scripts use environment variables
- [ ] Cloud Build uses substitution variables
- [ ] No credentials are logged in deployment output
- [ ] `.env` backup files are removed from git tracking

## If Credentials Are Accidentally Committed

1. **Immediately rotate/revoke the exposed credentials**
2. Remove from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (coordinate with team):
   ```bash
   git push origin --force --all
   ```

## Best Practices

1. **Never commit `.env` files**
2. **Use environment variables for deployment scripts**
3. **Use Google Secret Manager for production secrets** (recommended)
4. **Rotate credentials regularly**
5. **Use different credentials for dev/staging/production**
6. **Restrict API keys in Google Cloud Console** (by domain, IP, package, etc.)

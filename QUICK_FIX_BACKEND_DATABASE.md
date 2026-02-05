# Quick Fix: Backend Database Connection

## Problem

The backend is returning 500/503 errors because it's trying to connect to `localhost:5432` instead of Cloud SQL.

**Error in logs:**
```
❌ Background transaction sync job error: connect ECONNREFUSED 127.0.0.1:5432
```

## Solution

The backend needs the `DATABASE_URL` environment variable to connect to Cloud SQL.

## Quick Fix Command

Run this command with the database password:

```bash
gcloud config set account dialadrinkkenya254@gmail.com
gcloud config set project dialadrink-production

# Option 1: If you know the password
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project dialadrink-production \
  --add-cloudsql-instances=dialadrink-production:us-central1:dialadrink-db-prod \
  --update-env-vars "DATABASE_URL=postgresql://dialadrink_app:YOUR_PASSWORD@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod"

# Option 2: Reset password first (if you don't know it)
gcloud sql users set-password dialadrink_app \
  --instance=dialadrink-db-prod \
  --project=dialadrink-production \
  --password=NEW_SECURE_PASSWORD

# Then use the new password in Option 1
```

## Or Use the Script

```bash
./configure-backend-database.sh YOUR_PASSWORD
```

## Cloud SQL Details

- **Instance:** `dialadrink-db-prod`
- **Connection:** `dialadrink-production:us-central1:dialadrink-db-prod`
- **Database:** `dialadrink_prod`
- **User:** `dialadrink_app`

## Verify After Configuration

```bash
# Check logs (should see successful database connection)
gcloud run services logs read deliveryos-backend \
  --region us-central1 \
  --project dialadrink-production \
  --limit 20

# Test health endpoint
curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health

# Test API endpoint
curl https://deliveryos-backend-805803410802.us-central1.run.app/api/categories
```

## Additional Environment Variables Needed

After fixing the database, you may also need to configure:

- M-Pesa credentials (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, etc.)
- JWT secrets
- Other API keys

Check the old service for reference:
```bash
gcloud config set account lipanganya@gmail.com
gcloud config set project drink-suite
gcloud run services describe deliveryos-backend \
  --region us-central1 \
  --format="get(spec.template.spec.containers[0].env)"
```

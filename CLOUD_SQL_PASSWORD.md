# Google Cloud SQL Database Password

## Database User: `dialadrink_app`

### Password Found in Local Config

From `backend/.env`:
```
DATABASE_URL=postgres://dialadrink_app:f75ScLzQ8NCWC5iIZwp+FG07ONu+Uo6RnbGV07E/eTU=@localhost:5432/dialadrink
```

**Password**: `f75ScLzQ8NCWC5iIZwp+FG07ONu+Uo6RnbGV07E/eTU=`

## ⚠️ Important Notes

1. **Local vs Cloud**: The local `.env` shows `localhost`, but the password might be the same for Cloud SQL
2. **Verify in Google Cloud Console**: Always verify the actual Cloud SQL password

## How to Verify/Find Cloud SQL Password

### Option 1: Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Project: `drink-suite` (based on deployment guide)

2. **Navigate to Cloud SQL**
   - Go to: **SQL** → **Instances**
   - Find your Cloud SQL instance

3. **Check Connection String**
   - Click on your instance
   - Go to **"Connections"** tab
   - Look for **"Connection name"** or **"Public IP"** connection string
   - Format: `postgres://dialadrink_app:password@host:port/dialadrink`

4. **Reset Password (if needed)**
   - Go to **"Users"** tab
   - Find user: `dialadrink_app`
   - Click **"Reset Password"** if you need to change it

### Option 2: Check Cloud Run Environment Variables

1. **Go to Cloud Run**
   - Visit: https://console.cloud.google.com/run
   - Project: `drink-suite`
   - Find service: `dialadrink-backend`

2. **Check Environment Variables**
   - Click on the service
   - Go to **"Variables & Secrets"** tab
   - Look for `DATABASE_URL`
   - Extract password from connection string

### Option 3: Use gcloud CLI

```bash
# List Cloud SQL instances
gcloud sql instances list --project=drink-suite

# Get connection name
gcloud sql instances describe INSTANCE_NAME --project=drink-suite

# List users
gcloud sql users list --instance=INSTANCE_NAME --project=drink-suite
```

## Connection Details

Based on your configuration:

- **User**: `dialadrink_app`
- **Database**: `dialadrink`
- **Host**: Cloud SQL instance (check in GCP Console)
- **Port**: `5432` (default PostgreSQL port)
- **Password**: `f75ScLzQ8NCWC5iIZwp+FG07ONu+Uo6RnbGV07E/eTU=` (verify in GCP)

## Security Best Practices

1. ✅ **Never commit passwords to git** (already in `.gitignore`)
2. ✅ **Use Secret Manager** for production passwords
3. ✅ **Rotate passwords regularly**
4. ✅ **Use different passwords** for local vs cloud (recommended)

## If Password Doesn't Work

1. **Reset in Cloud Console**:
   - SQL → Instances → Your Instance → Users
   - Click on `dialadrink_app` → Reset Password

2. **Update Cloud Run**:
   - Update `DATABASE_URL` environment variable with new password
   - Redeploy if needed

3. **Update Local `.env`**:
   - Update `DATABASE_URL` in `backend/.env` if connecting locally


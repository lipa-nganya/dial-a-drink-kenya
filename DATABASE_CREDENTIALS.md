# Database Credentials

## Development Database

- **Instance**: `dialadrink-db-dev`
- **Database**: `dialadrink_dev`
- **User**: `dialadrink_app`
- **Password**: `o61yqm5fLiTwWnk5`
- **Connection Name**: `dialadrink-production:us-central1:dialadrink-db-dev`
- **Region**: `us-central1`
- **Project**: `dialadrink-production`

### Connection String (Cloud Run)
```
postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev
```

### Connection String (External/psql)
```
postgresql://dialadrink_app:o61yqm5fLiTwWnk5@<IP_ADDRESS>:5432/dialadrink_dev?sslmode=require
```

**Note**: Get IP address with:
```bash
gcloud sql instances describe dialadrink-db-dev --format="get(ipAddresses[0].ipAddress)" --project dialadrink-production
```

---

## Production Database

- **Instance**: `dialadrink-db-prod`
- **Database**: `dialadrink_prod`
- **User**: `dialadrink_app`
- **Password**: `E7A3IIa60hFD3bkGH1XAiryvB`
- **Connection Name**: `dialadrink-production:us-central1:dialadrink-db-prod`
- **Region**: `us-central1`
- **Project**: `dialadrink-production`

### Connection String (Cloud Run)
```
postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod
```

### Connection String (External/psql)
```
postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@<IP_ADDRESS>:5432/dialadrink_prod?sslmode=require
```

**Note**: Get IP address with:
```bash
gcloud sql instances describe dialadrink-db-prod --format="get(ipAddresses[0].ipAddress)" --project dialadrink-production
```

---

## Backend Services

### Development Backend
- **Service**: `deliveryos-development-backend`
- **Database**: Uses `dialadrink-db-dev` / `dialadrink_dev`
- **URL**: (Check with `gcloud run services list`)

### Production Backend
- **Service**: `deliveryos-production-backend`
- **Database**: Uses `dialadrink-db-prod` / `dialadrink_prod`
- **URL**: (Check with `gcloud run services list`)

---

## Security Notes

⚠️ **IMPORTANT**: 
- Keep these credentials secure
- Do NOT commit passwords to git
- Rotate passwords regularly
- Use Cloud SQL IAM authentication when possible
- Restrict database access to authorized IPs only

---

## Quick Commands

### Get Database IP Addresses
```bash
# Development
gcloud sql instances describe dialadrink-db-dev --format="get(ipAddresses[0].ipAddress)" --project dialadrink-production

# Production
gcloud sql instances describe dialadrink-db-prod --format="get(ipAddresses[0].ipAddress)" --project dialadrink-production
```

### Connect via Cloud SQL Proxy
```bash
# Development
cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-dev=tcp:5432

# Production
cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-prod=tcp:5433
```

### Connect via psql (after whitelisting IP)
```bash
# Development
psql "postgresql://dialadrink_app:o61yqm5fLiTwWnk5@<DEV_IP>:5432/dialadrink_dev?sslmode=require"

# Production
psql "postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@<PROD_IP>:5432/dialadrink_prod?sslmode=require"
```

# Database Connection Guide

## Production Database Connection

### Correct Connection Details

**IP Address:** `35.223.10.1`  
**Port:** `5432`  
**Database:** `dialadrink_prod`  
**Username:** `dialadrink_app` (NOT `postgres`)  
**Password:** `E7A3IIa60hFD3bkGH1XAiryvB`  
**SSL Required:** Yes

### Connection Strings

#### For psql (command line):
```bash
psql "postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@35.223.10.1:5432/dialadrink_prod?sslmode=require"
```

#### For pgAdmin or other GUI tools:
- **Host:** `35.223.10.1`
- **Port:** `5432`
- **Database:** `dialadrink_prod`
- **Username:** `dialadrink_app`
- **Password:** `E7A3IIa60hFD3bkGH1XAiryvB`
- **SSL Mode:** `require`

#### For Node.js/JavaScript:
```javascript
const { Client } = require('pg');

const client = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});
```

#### Connection String Format:
```
postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@35.223.10.1:5432/dialadrink_prod?sslmode=require
```

---

## Development Database Connection

### Correct Connection Details

**IP Address:** `34.41.187.250`  
**Port:** `5432`  
**Database:** `dialadrink_dev`  
**Username:** `dialadrink_app` (NOT `postgres`)  
**Password:** `o61yqm5fLiTwWnk5`  
**SSL Required:** Yes

### Connection Strings

#### For psql (command line):
```bash
psql "postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require"
```

#### For pgAdmin or other GUI tools:
- **Host:** `34.41.187.250`
- **Port:** `5432`
- **Database:** `dialadrink_dev`
- **Username:** `dialadrink_app`
- **Password:** `o61yqm5fLiTwWnk5`
- **SSL Mode:** `require`

---

## Common Issues

### ❌ Error: "password authentication failed for user 'postgres'"

**Problem:** You're trying to connect with username `postgres`, but the database uses `dialadrink_app`.

**Solution:** Use username `dialadrink_app` instead of `postgres`.

### ❌ Error: "connection refused" or "timeout"

**Possible causes:**
1. Your IP address is not whitelisted in Cloud SQL
2. Firewall blocking the connection
3. Database instance is not running

**Solution:**
1. Check if your IP is whitelisted:
   ```bash
   gcloud sql instances describe dialadrink-db-prod \
     --project dialadrink-production \
     --format="get(settings.ipConfiguration.authorizedNetworks)"
   ```

2. Add your IP to authorized networks:
   ```bash
   gcloud sql instances patch dialadrink-db-prod \
     --authorized-networks=YOUR_IP_ADDRESS/32 \
     --project dialadrink-production
   ```

### ❌ Error: "SSL connection required"

**Solution:** Make sure to use `sslmode=require` in your connection string or enable SSL in your database client.

---

## Quick Connection Test

### Test Production Connection:
```bash
psql "postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@35.223.10.1:5432/dialadrink_prod?sslmode=require" -c "SELECT version();"
```

### Test Development Connection:
```bash
psql "postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require" -c "SELECT version();"
```

---

## Important Notes

⚠️ **Username is `dialadrink_app`, NOT `postgres`**  
⚠️ **SSL is required for both databases**  
⚠️ **Your IP must be whitelisted in Cloud SQL authorized networks**

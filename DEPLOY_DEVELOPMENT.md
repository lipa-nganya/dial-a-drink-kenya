# Deploy Local Changes to Development

Deploy from local to the **development** environment. Frontends are on Netlify (no GCloud frontend services). Backend updates the **existing** Cloud Run service. No credentials are stored in the repo or in scripts.

---

## Prerequisites

- **gcloud CLI** installed and authenticated (no key files in repo)
- **Account:** `dialadrinkkenya254@gmail.com`
- **Project:** `dialadrink-production`
- **Do not commit:** `.env`, `DATABASE_CREDENTIALS*`, `*-key.json`, or any file containing `DATABASE_URL` or API keys

---

## One-Command Deploy

From the **project root**:

```bash
./deploy-to-development.sh
```

This script:

| Step | What it does |
|------|----------------|
| 1 | Verifies gcloud account (`dialadrinkkenya254@gmail.com`) and project; **no keys in script** |
| 2 | Ensures `.env` is not tracked by git (fails if committed) |
| 3 | **Git push to `develop`** → Netlify auto-deploys **customer** and **admin** frontends (no GCloud frontend services created) |
| 4 | **Deploys backend** to existing Cloud Run service `deliveryos-development-backend` (no new service); **CORS** kept via existing `FRONTEND_URL` / `ADMIN_URL` |
| 5 | **Migrations:** runs if `DATABASE_URL` is set in your environment; otherwise prints manual steps (see below) |
| 6 | **Android:** code is in repo (`driver-app-native`); build separately if needed |

---

## gcloud Auth (No Exposed Keys)

Use **application-default or user login** only. Do not commit service account key JSON files.

```bash
# Login (no key file; credentials stay local)
gcloud auth login dialadrinkkenya254@gmail.com

# Optional: application-default for local tools
gcloud auth application-default login

# Set project
gcloud config set project dialadrink-production
```

**Never:**

- Add `*.json` key files or `DATABASE_CREDENTIALS*.txt` to git (they are in `.gitignore`)
- Put `DATABASE_URL`, API keys, or secrets in any script or committed file
- Create new frontend services on GCloud (frontends are on Netlify and deploy from GitHub)

---

## Database Migrations

Migrations run only when **you** set `DATABASE_URL` in your environment (e.g. from a local `.env` that is **not** committed). The script never logs or passes `DATABASE_URL` on the command line.

**Verify Cloud SQL access (proxy / migrations):**  
The identity in `application_default_credentials.json` (used by Cloud SQL Proxy) must have **Cloud SQL Client** so the proxy can connect. IAM DB auth is optional (dev uses password auth).

If the proxy logs **403 NOT_AUTHORIZED** or "missing permission cloudsql.instances.get", refresh ADC with Cloud SQL scopes:

```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/sqlservice.admin
```

Then run:

```bash
./scripts/verify-cloud-sql-dev-access.sh        # check
./scripts/verify-cloud-sql-dev-access.sh --fix # grant Cloud SQL Client / Viewer if missing
```

**Option A – Run during deploy**

1. Start Cloud SQL Proxy (in a separate terminal):
   ```bash
   cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-dev=tcp:5432
   ```
2. In `.env` (backend folder, not committed) set:
   ```bash
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/dialadrink_dev
   ```
3. From project root:
   ```bash
   source backend/.env   # or export DATABASE_URL=...
   ./deploy-to-development.sh
   ```
   Step 5 will run migrations using your env.

**Option B – Run after deploy**

1. Start Cloud SQL Proxy as above (or use Docker option below).
2. Set `DATABASE_URL` in backend `.env` (or export it).
3. From `backend`:
   ```bash
   NODE_ENV=development ./scripts/run-cloud-sql-migrations.js
   ```
   Or: `./scripts/run-migrations-cloud-sql.sh` (same script the deploy uses when `DATABASE_URL` is set).

**Option C – Migrations via Docker (proxy + migrations in containers)**

If you get "Connection terminated unexpectedly" from the host, run migrations inside Docker on the same network as the proxy:

```bash
./scripts/run-dev-migrations-docker.sh --in-container
```

Ensure Cloud SQL access first: `./scripts/verify-cloud-sql-dev-access.sh --fix`.

---

## CORS

CORS is **unchanged** by this deploy. The script only updates non-secret env vars (`NODE_ENV`, `FRONTEND_URL`, `ADMIN_URL`, `HOST`, etc.). Existing `FRONTEND_URL` and `ADMIN_URL` on the Cloud Run service are preserved when present.

---

## Summary

- **Frontend (customer + admin):** Push to GitHub `develop` → Netlify deploys. **No GCloud frontend services.**
- **Backend:** Deploy to **existing** `deliveryos-development-backend`; **no new backend service.**
- **Android:** Code lives in repo; push to `develop` updates it; build APK separately (e.g. `cd driver-app-native && ./gradlew assembleDevelopmentDebug`).
- **Migrations:** Run when `DATABASE_URL` is set in your environment, or manually with Cloud SQL Proxy + `.env`.
- **Credentials:** Use gcloud login only; do not commit `.env`, key files, or `DATABASE_CREDENTIALS*`.

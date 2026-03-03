# Deploy to Develop Environment

Deploy local changes to development: backend to existing Cloud Run service, frontend via Netlify (GitHub), Android code pushed to repo. No credentials in scripts.

## Prerequisites

1. **Google Cloud SDK** installed and authenticated  
   ```bash
   gcloud auth login dialadrinkkenya254@gmail.com
   gcloud config set project dialadrink-production
   ```
2. **No credentials in repo**  
   - Do not commit `.env` or any file containing `DATABASE_URL`, API keys, or passwords.  
   - Ensure `.env` is in `.gitignore`.  
   - GCloud key/account is set via `gcloud config`; do not commit service account JSON keys.
3. **Backend**  
   - `DATABASE_URL` must already be set on the Cloud Run service `deliveryos-development-backend` (e.g. via Console or a one-time secure setup). Deploy scripts only update non-secret env vars (CORS URLs, etc.).

## Quick deploy

```bash
./deploy-to-development.sh
```

This will:

- Set gcloud account to `dialadrinkkenya254@gmail.com` and project `dialadrink-production`
- Check that no credentials are committed
- Push to GitHub `develop` (Netlify auto-deploys frontend; no new GCloud frontend services)
- Deploy backend to **existing** service `deliveryos-development-backend` (no new backend service)
- Preserve CORS (`FRONTEND_URL`, `ADMIN_URL`); other env vars (e.g. `DATABASE_URL`) unchanged
- Run database migrations if `DATABASE_URL` is set or can be read from the dev backend service (adds inventory `tags`, `pageTitle`, `keywords`, `youtubeUrl`)

## Database migrations (tags, pageTitle, etc.)

Migrations add `pageTitle`, `keywords`, `youtubeUrl`, `tags` to `drinks` for inventory SEO.

- **Automatic**: If `DATABASE_URL` is in your environment, or gcloud can read it from the development backend service, `deploy-to-development.sh` runs migrations.
- **Manual**:  
  1. Start Cloud SQL Proxy:  
     `cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-dev=tcp:5432 &`  
  2. Set `DATABASE_URL` in `.env` (not committed), e.g.:  
     `postgresql://USER:PASSWORD@localhost:5432/dialadrink_dev`  
  3. Run:  
     `cd backend && NODE_ENV=development ./scripts/run-migrations-cloud-sql.sh`

## CORS

CORS is configured in `backend/app.js` using `FRONTEND_URL` and `ADMIN_URL`. Deploy keeps these on the service; no change needed.

## Android app

- Code lives in `driver-app-native/` and is pushed to GitHub with the rest of the repo.
- To build for development:  
  `cd driver-app-native && ./gradlew assembleDevelopmentDebug`  
- APK: `app/build/outputs/apk/development/debug/app-development-debug.apk`  
- No new GCloud frontend services; frontends are on Netlify.

## Verify

- Backend: `curl https://deliveryos-development-backend-XXXX.run.app/api/health`
- Frontend: Netlify dashboard (deploys from GitHub)
- Migrations: Check `drinks` table for `pageTitle`, `keywords`, `youtubeUrl`, `tags` columns

# Deployment to Development – Prompt for Future Use

Use this prompt when you want to deploy local changes to development. It includes the fixes needed for migrations and Netlify builds to succeed.

---

## Paste this prompt

**Deploy changes from local to development.**

- **Scope:** Deploy to the **development** environment only. Do **not** create any new GCloud services.
- **CORS:** Preserve existing CORS configuration. The backend already has `FRONTEND_URL` and `ADMIN_URL` set; do not overwrite or remove them.
- **Database migrations:** Run all necessary migrations against the **dev** Cloud SQL instance (`dialadrink-db-dev` / `dialadrink_dev`). Ensure migrations can connect before/after deploy:
  - The Cloud SQL Proxy uses **Application Default Credentials (ADC)**. If the proxy logs **403 NOT_AUTHORIZED** or "missing permission cloudsql.instances.get", refresh ADC with Cloud SQL scopes:  
    `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/sqlservice.admin`
  - Ensure the ADC identity has **Cloud SQL Client** and **Cloud SQL Viewer** (for instance metadata). Run `./scripts/verify-cloud-sql-dev-access.sh` to check; use `--fix` to grant missing roles.
  - Migrations can be run via: deploy script when `DATABASE_URL` is set; or `./scripts/run-dev-migrations-docker.sh` (host) / `./scripts/run-dev-migrations-docker.sh --in-container` (Docker). If you get "Connection terminated unexpectedly", use the `--in-container` option and ensure ADC was refreshed as above.
- **Frontends:** Do **not** create or use GCloud frontend services. Frontends are on **Netlify** and deploy automatically from GitHub when code is pushed to `develop`. Ensure the codebase is ready for Netlify: **CI treats ESLint warnings as errors** (`process.env.CI = true`). Before pushing, fix or resolve: unused variables/imports (`no-unused-vars`), missing React Hook dependencies (`react-hooks/exhaustive-deps`), and any other ESLint warnings so both **frontend** and **admin-frontend** builds succeed.
- **Backend:** Deploy to the **existing** Cloud Run service only (e.g. `deliveryos-development-backend`). Do **not** create a new backend service.
- **Android:** Push the Android app code to the `develop` branch (e.g. in `driver-app-native`). Building the APK is separate; the deploy only ensures the code is on `develop`.
- **GCloud account:** Use account `dialadrinkkenya254@gmail.com` and project `dialadrink-production`.
- **Credentials and keys:** Do **not** expose credentials or keys. Use `gcloud auth login` and `gcloud auth application-default login` only; do **not** commit or embed service account key JSON files, `.env` files, `DATABASE_URL`, or `DATABASE_CREDENTIALS*`. Ensure `.gitignore` excludes credential patterns and that the deploy script never logs or passes secrets.

---

## One-line summary

Deploy to development: push to `develop` (Netlify deploys frontends; fix ESLint so builds pass), deploy backend to existing Cloud Run (preserve CORS), run DB migrations (refresh ADC scopes + verify Cloud SQL access if 403; use Docker in-container if needed), push Android code to `develop`, use gcloud account `dialadrinkkenya254@gmail.com`, no new services, no exposed credentials.

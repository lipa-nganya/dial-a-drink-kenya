# Deployment to Production – Prompt for Future Use

Use this prompt when you want to deploy local changes to production. Frontends are on GCloud (not Netlify). No new services; update existing ones only.

---

## Paste this prompt

**Deploy changes from local to production.**

- **Scope:** Deploy to the **production** environment only. Do **not** create any new GCloud services.
- **CORS:** Preserve existing CORS configuration. The backend already has `FRONTEND_URL` and `ADMIN_URL` set for production; do not overwrite or remove them.
- **Database migrations:** Run any necessary migrations against the **production** Cloud SQL instance (`dialadrink-db-prod` / `dialadrink_prod`). Ensure migrations can connect:
  - The Cloud SQL Proxy uses **Application Default Credentials (ADC)**. If the proxy logs **403 NOT_AUTHORIZED** or "missing permission cloudsql.instances.get", refresh ADC with Cloud SQL scopes:  
    `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/sqlservice.admin`
  - Ensure the ADC identity has **Cloud SQL Client** and **Cloud SQL Viewer** (or equivalent) for the production instance. Use the same pattern as dev: verify IAM roles and use `--fix` if a verify script exists for prod.
  - Run migrations via the deploy script when `DATABASE_URL` is set for prod, or via Cloud SQL Proxy (e.g. `dialadrink-production:us-central1:dialadrink-db-prod`) then `run-cloud-sql-migrations.js` with production `DATABASE_URL`. If you get "Connection terminated unexpectedly", ensure ADC was refreshed as above.
- **Frontends:** Do **not** create new frontend services. **Frontend services already exist on GCloud** (not Netlify). Deploy or update the **existing** GCloud frontend services (customer and admin) with the new build; do not create additional frontend services.
- **Backend:** Deploy to the **existing** Cloud Run service only (e.g. `deliveryos-production-backend`). Do **not** create a new backend service.
- **Android:** Push the Android app code to the **production** branch (e.g. `main` or your production branch) so production builds use it. Building the production APK/AAB is separate; the deploy ensures the code is on the production branch.
- **GCloud account:** Use account `dialadrinkkenya254@gmail.com` and project `dialadrink-production`.
- **Credentials and keys:** Do **not** expose credentials or keys. Ensure gcloud is configured (e.g. `gcloud auth login`, `gcloud auth application-default login`) and that **no key files or secrets are committed or exposed**. Do **not** commit or embed service account key JSON files, `.env` / `.env.production`, `DATABASE_URL`, or `DATABASE_CREDENTIALS*`. Ensure `.gitignore` excludes credential patterns and that deploy scripts never log or pass secrets.

---

## One-line summary

Deploy to production: update existing GCloud frontend services (no new ones, frontends are on GCloud not Netlify), deploy backend to existing Cloud Run (preserve CORS), run DB migrations against prod (refresh ADC scopes + verify Cloud SQL access if 403), push Android code to production branch, use gcloud account `dialadrinkkenya254@gmail.com`, no new services, no exposed credentials.

# Production deployment

- **Account:** `dialadrinkkenya254@gmail.com`
- **Project:** `dialadrink-production`
- **No credentials in repo:** `DATABASE_URL` and secrets are read from the existing backend service. Do not commit `production-config.env` or any file containing passwords (see `.gitignore`).

## One-command deploy

```bash
./deploy-production.sh
```

This script:

1. **Checks gcloud:** Uses account `dialadrinkkenya254@gmail.com` and project `dialadrink-production`. Ensure you are logged in (`gcloud auth login`) and that no secret keys are stored in the repo.
2. **Builds backend** and deploys to existing **deliveryos-production-backend** (no new service). Existing env vars (CORS, DATABASE_URL, M-Pesa, etc.) are kept.
3. **Runs DB migrations** (SEO columns: `pageTitle`, `keywords`, `youtubeUrl`, `tags`) via a one-off Cloud Run Job using `DATABASE_URL` from the current backend.
4. **Deploys frontends** to existing GCloud Cloud Run services (not Netlify):
   - **deliveryos-customer-frontend**
   - **deliveryos-admin-frontend**
5. **Pushes Android app code** (commits and pushes `driver-app-native` if there are changes). Push to `main` or your production branch manually if needed.

## Optional: sync slugs / tags / page titles to production DB

If you have a source DB (e.g. local or dev) and want to copy slugs, tags, and page titles into production:

1. Do **not** put credentials in the repo. Set env vars only in your shell or a local, gitignored file.
2. Run the same sync scripts used for dev, but point `DATABASE_URL` at production (e.g. Cloud SQL proxy or approved IP):

   ```bash
   cd backend
   SOURCE_DATABASE_URL="postgresql://user:pass@localhost:5432/your_source_db" \
   DATABASE_URL="postgresql://user:pass@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod" \
   node scripts/sync-tags-from-local-to-dev.js
   SOURCE_DATABASE_URL="..." DATABASE_URL="..." node scripts/sync-slugs-from-local-to-dev.js
   ```

   Use the same pattern for any other one-off data sync scripts.

## CORS

CORS is controlled by the backend env vars `FRONTEND_URL` and `ADMIN_URL` on **deliveryos-production-backend**. The deploy script does not change them; they remain as already configured (e.g. production domains).

## Android production build

After pushing code, build the production APK (e.g. for Play Store or distribution):

```bash
./build-android-production.sh
```

Ensure `driver-app-native/gradle.properties` has the correct `PROD_API_BASE_URL` (production backend URL). The deploy script does not modify this; set it via env or a local, uncommitted config if needed.

# CI/CD and Infrastructure Automation Roadmap

## Cloud Run backend

### Cloud Build trigger
`cloudbuild-backend.yaml`
```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/dialadrink-backend', '.']
    dir: backend
  - name: gcr.io/cloud-builders/docker
    args: ['push', 'gcr.io/$PROJECT_ID/dialadrink-backend']
  - name: gcr.io/cloud-builders/gcloud
    args:
      - run
      - deploy
      - dialadrink-backend
      - --image=gcr.io/$PROJECT_ID/dialadrink-backend
      - --region=us-central1
      - --allow-unauthenticated
      - --set-env-vars=NODE_ENV=production,PORT=8080
substitutions:
  _REGION: us-central1
options:
  logging: CLOUD_LOGGING_ONLY
```
Trigger on `main` pushes so backend redeploys automatically.

### Secrets
- Store MPesa keys and JWT secrets in Secret Manager.
- During deploy add `--update-secrets` flags or mount as env vars.
- Grant `roles/secretmanager.secretAccessor` to the Cloud Run service account.

## Static frontends

### Cloud Build trigger
`cloudbuild-frontend.yaml`
```yaml
steps:
  - name: gcr.io/cloud-builders/npm
    dir: frontend
    args: ['ci']
  - name: gcr.io/cloud-builders/npm
    dir: frontend
    args: ['run', 'build']
  - name: gcr.io/cloud-builders/gsutil
    dir: frontend/build
    entrypoint: bash
    args: ['-c', 'gsutil -m rsync -r . gs://$PROJECT_ID-customer-web']
```
Create a similar trigger for `admin-frontend`.

### CDN invalidation
After `gsutil rsync`, optionally purge CDN cache:
```bash
gcloud compute url-maps invalidate-cdn-cache customer-site-map --path "/*"
```

## Driver app

- Store `EXPO_PUBLIC_API_BASE_URL` in EAS environment variables per channel.
- Automate OTA updates via `eas update --non-interactive` in CI when backend host changes.
- For store builds, run `eas build --platform ios/android` in release pipelines.

## Terraform (optional next phase)

Recommended modules:
- `google_project`
- `google_project_service` (enable APIs)
- `google_storage_bucket` and `google_compute_backend_bucket`
- `google_cloud_run_service`
- `google_cloud_run_service_iam_policy`
- `google_service_account`, `google_project_iam_member`
- `google_monitoring_budget`

Use remote state (e.g. Cloud Storage) and wrap with CI (GitHub Actions or Cloud Build).

